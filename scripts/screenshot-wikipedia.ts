#!/usr/bin/env ts-node
/**
 * Simple script to take a screenshot of wikipedia.com using Playwright
 * This script uses proper configuration for headless environments without GPU
 */

import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

async function takeScreenshot() {
  let browser: Browser | null = null
  
  try {
    console.log('🚀 Launching browser with software rendering...')
    
    // Launch browser with flags to disable GPU and use software rendering
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-features=TranslateUI',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-first-run',
        '--enable-automation',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-device-scale-factor=1',
        '--hide-scrollbars',
        '--mute-audio',
        '--use-gl=swiftshader', // Use software rendering instead of hardware
      ],
      timeout: 60000, // 60 second timeout
    })

    console.log('✅ Browser launched successfully')
    console.log('📄 Creating new page...')
    
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    })

    console.log('🌐 Navigating to wikipedia.com...')
    await page.goto('https://wikipedia.com', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    console.log('📸 Taking screenshot...')
    const screenshotPath = path.join(process.cwd(), 'wikipedia-screenshot.png')
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    })

    console.log(`✅ Screenshot saved to: ${screenshotPath}`)
    console.log(`📊 File size: ${(fs.statSync(screenshotPath).size / 1024).toFixed(2)} KB`)

    return screenshotPath
  } catch (error: any) {
    console.error('❌ Error taking screenshot:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    throw error
  } finally {
    if (browser) {
      console.log('🔒 Closing browser...')
      await browser.close()
    }
  }
}

// Run if executed directly
if (require.main === module) {
  takeScreenshot()
    .then((path) => {
      console.log(`\n✨ Success! Screenshot saved to: ${path}`)
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Failed to take screenshot:', error)
      process.exit(1)
    })
}

export { takeScreenshot }
