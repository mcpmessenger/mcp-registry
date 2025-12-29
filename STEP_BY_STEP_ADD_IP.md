# Step-by-Step: Add IP to Cloud SQL Authorized Networks

## Your IP to Add
`147.92.98.214/32`

## Detailed Steps

### Step 1: Go to Cloud SQL Console

Go to: https://console.cloud.google.com/sql/instances/mcp-registry-db?project=554655392699

### Step 2: Click "Edit" or Go to Connections

- You'll see an **"Edit"** button (pencil icon) at the top, OR
- Click on **"Connections"** in the left sidebar

### Step 3: Find "Authorized networks" Section

Scroll down until you see a section titled:
- **"Authorized networks"**
- It shows text like "You can specify CIDR ranges..."
- You'll see existing networks listed (like `35.239.196.223`)

### Step 4: Click "Add a network" Button

- Click the blue **"+ Add a network"** button (or "Add network" button)
- A dialog/modal will appear

### Step 5: Enter Your IP in the Dialog

In the dialog that appears, you'll see two fields:

1. **Name field** (optional):
   - Enter: `My Local IP` (or any name you want)
   - This is just a label for your reference

2. **Network field** (required):
   - Enter: `147.92.98.214/32`
   - This is your IP with `/32` suffix (means single IP address)

### Step 6: Save

- Click **"Done"** or **"Add"** button in the dialog
- The dialog will close and you'll see your IP in the list

### Step 7: Save the Changes

- Scroll to the bottom of the page
- Click the blue **"Save"** button
- Wait for confirmation (usually takes 10-30 seconds)

### Step 8: Wait

Wait about 1-2 minutes for the change to take effect.

## Visual Guide

You should see something like:
```
Authorized networks
[You can specify CIDR ranges...]

35.239.196.223                    [trash icon]
[+ Add a network] button
```

After clicking, a dialog appears:
```
Add network
Name: [My Local IP        ]
Network: [147.92.98.214/32     ]

[Cancel] [Done]
```

## After Adding

Once saved, you can run migrations:
```powershell
cd backend
npx prisma migrate deploy
```

