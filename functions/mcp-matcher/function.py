#!/usr/bin/env python3
"""
Pulsar Function for MCP Matcher
Consumes user-requests and publishes tool-signals when matches are found.

This function replaces the separate MCP Matcher microservice, running directly
on Pulsar brokers for reduced latency and infrastructure overhead.
"""

import json
import re
import os
from typing import Dict, Any, Optional
import requests
from pulsar import Function

# Configuration from function config
REGISTRY_API_URL = os.getenv('REGISTRY_API_URL', 'http://localhost:3001')
CONFIDENCE_THRESHOLD = float(os.getenv('CONFIDENCE_THRESHOLD', '0.7'))

# Keyword patterns for high-signal queries (matching backend/src/services/orchestrator/matcher.ts)
KEYWORD_PATTERNS = [
    {
        'pattern': r'\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|temp|weather|forecast|climate).*?(in|at|for|of)\b',
        'toolId': 'lookup_weather',
        'serverId': 'modelcontextprotocol/google-maps',
        'confidence': 0.98,
    },
    {
        'pattern': r'\b(how.*?hot|cold|warm|weather.*?in|temp.*?in)\b',
        'toolId': 'lookup_weather',
        'serverId': 'modelcontextprotocol/google-maps',
        'confidence': 0.95,
    },
    {
        'pattern': r'\b(directions|route|routes|navigate|navigation|how do i get|how to get|get from|drive from|walk from|bike from|transit from)\b.*\bfrom\b.*\bto\b',
        'toolId': 'compute_routes',
        'serverId': 'modelcontextprotocol/google-maps',
        'confidence': 0.92,
    },
    {
        'pattern': r'\b(when|where|find|search|look for).*?(concert|playing|show|ticket|event|tour)\b',
        'toolId': 'web_search_exa',
        'serverId': 'io.github.exa-labs/exa-mcp-server',
        'confidence': 0.9,
    },
    {
        'pattern': r'\b(concert|playing|show|ticket).*?(in|at|near|for)\b',
        'toolId': 'web_search_exa',
        'serverId': 'io.github.exa-labs/exa-mcp-server',
        'confidence': 0.85,
    },
    {
        'pattern': r'\b(find|search|look for|where).*?(coffee|restaurant|cafe|shop|store|bar|pizza|food|record|book|clothing|grocery|gas|hotel|museum|park|theater).*?(in|at|near)\b',
        'toolId': 'search_places',
        'serverId': 'modelcontextprotocol/google-maps',
        'confidence': 0.9,
    },
    {
        'pattern': r'\b(check|visit|go to|navigate).*?\.(com|org|net|io)\b',
        'toolId': 'browser_navigate',
        'serverId': 'com.microsoft.playwright/mcp',
        'confidence': 0.8,
    },
]


def extract_search_params(query: str) -> Dict[str, Any]:
    """Extract search parameters from query (simplified version)."""
    params: Dict[str, Any] = {}
    
    # Extract directions/routes
    directions_match = re.search(r'\bfrom\s+(.+?)\s+to\s+(.+?)(?:\s*$|\s+by\b|\s+via\b)', query, re.IGNORECASE)
    if directions_match and re.search(r'\b(directions|route|routes|navigate|navigation|get from|how do i get|how to get)\b', query, re.IGNORECASE):
        origin = directions_match.group(1).strip()
        destination = directions_match.group(2).strip()
        
        travel_mode = 'DRIVE'
        if re.search(r'\bwalk|walking\b', query, re.IGNORECASE):
            travel_mode = 'WALK'
        elif re.search(r'\bbike|bicycle|cycling\b', query, re.IGNORECASE):
            travel_mode = 'BICYCLE'
        elif re.search(r'\btransit|bus|train|subway\b', query, re.IGNORECASE):
            travel_mode = 'TRANSIT'
        
        params['origin'] = {'address': origin}
        params['destination'] = {'address': destination}
        params['travelMode'] = travel_mode
        return params
    
    # Extract weather queries
    weather_match = re.search(r'\b(what.*?temp|what.*?weather|whats.*?temp|whats.*?weather|temperature|temp|weather|forecast).*?(in|at|for|of)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)\b', query, re.IGNORECASE)
    if weather_match:
        location_name = weather_match.group(3).strip()
        params['location'] = {'address': location_name}
        return params
    
    # Extract places queries
    places_match = re.search(r'\b(find|search|look for|where)\s+(.+?)\s+(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', query, re.IGNORECASE)
    if places_match:
        params['textQuery'] = f"{places_match.group(2).strip()} in {places_match.group(4).strip()}"
        return params
    
    # Fallback: extract search query
    search_match = re.search(r'(?:when|where|find|search|look for)\s+(.+?)(?:\s+in|\s+at|$)', query, re.IGNORECASE)
    if search_match:
        params['query'] = search_match.group(1).strip()
    else:
        params['query'] = query
    
    return params


def match_keyword_pattern(query: str) -> Optional[Dict[str, Any]]:
    """Match query against keyword patterns."""
    for pattern_config in KEYWORD_PATTERNS:
        pattern = re.compile(pattern_config['pattern'], re.IGNORECASE)
        if pattern.search(query):
            params = extract_search_params(query)
            return {
                'toolId': pattern_config['toolId'],
                'serverId': pattern_config['serverId'],
                'confidence': pattern_config['confidence'],
                'params': params,
            }
    return None


def verify_server_exists(server_id: str) -> bool:
    """Verify server exists in registry (via API call)."""
    try:
        response = requests.get(
            f'{REGISTRY_API_URL}/v0.1/servers/{server_id}',
            timeout=2
        )
        return response.status_code == 200
    except Exception:
        # If registry is unavailable, assume server exists (fail open)
        return True


class MCPMatcherFunction(Function):
    """Pulsar Function that matches user requests to MCP tools."""
    
    def process(self, input, context):
        """
        Process a user request event and emit tool signal if match found.
        
        Input: JSON string of UserRequestEvent
        Output: JSON string of ToolSignalEvent (if match found), None otherwise
        """
        try:
            # Parse input event
            if isinstance(input, bytes):
                input_str = input.decode('utf-8')
            else:
                input_str = str(input)
            
            event = json.loads(input_str)
            request_id = event.get('requestId')
            normalized_query = event.get('normalizedQuery', '')
            
            if not request_id or not normalized_query:
                context.get_logger().warn(f'Invalid event: missing requestId or normalizedQuery')
                return None
            
            context.get_logger().info(f'Processing request {request_id}: "{normalized_query[:50]}..."')
            
            # Try keyword pattern matching first (fastest)
            match = match_keyword_pattern(normalized_query)
            
            if match and match['confidence'] >= CONFIDENCE_THRESHOLD:
                # Verify server exists in registry
                if not verify_server_exists(match['serverId']):
                    context.get_logger().warn(f'Server {match["serverId"]} not found in registry, skipping match')
                    return None
                
                # Create tool signal event
                tool_signal = {
                    'requestId': request_id,
                    'toolId': match['toolId'],
                    'serverId': match['serverId'],
                    'params': match['params'],
                    'confidence': match['confidence'],
                    'status': 'TOOL_READY',
                    'timestamp': context.get_message_timestamp() or int(context.get_current_message_topic_name().split('_')[-1]) if hasattr(context, 'get_message_timestamp') else None,
                }
                
                # Use current timestamp if message timestamp not available
                if not tool_signal['timestamp']:
                    from datetime import datetime
                    tool_signal['timestamp'] = datetime.utcnow().isoformat() + 'Z'
                
                context.get_logger().info(
                    f'Emitted TOOL_READY for {request_id}: {match["serverId"]}::{match["toolId"]} '
                    f'(confidence: {match["confidence"]})'
                )
                
                return json.dumps(tool_signal)
            else:
                context.get_logger().debug(f'No high-confidence match for {request_id}')
                return None
                
        except json.JSONDecodeError as e:
            context.get_logger().error(f'Failed to parse input as JSON: {e}')
            return None
        except Exception as e:
            context.get_logger().error(f'Error processing message: {e}')
            return None
