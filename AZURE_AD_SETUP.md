# Microsoft 365 / Azure AD Integration Setup

This guide will help you set up Microsoft 365 authentication for your QR Attendance System.

## Step 1: Create an Azure AD App Registration

1. Go to the [Azure Portal](https://portal.azure.com)
2. Search for and select **Azure Active Directory**
3. In the left sidebar, click **App registrations**
4. Click **New registration**
5. Fill in the details:
   - **Name**: QR Attendance System
   - **Supported account types**: Choose one:
     - Accounts in this organizational directory only (Single tenant) - for internal use
     - Accounts in any organizational directory (Multitenant) - for multiple organizations
     - Accounts in any organizational directory and personal Microsoft accounts - for broadest access
   - **Redirect URI (optional)**: Select **Web** and enter `http://localhost:3000/api/auth/callback/azure-ad`
6. Click **Register**

## Step 2: Configure App Registration

1. After registration, you'll see your application overview page
2. Note down the **Application (client) ID** - this is your `AZURE_AD_CLIENT_ID`
3. Click **Certificates & secrets** in the left sidebar
4. Under **Client secrets**, click **New client secret**
5. Add a description and select an expiration period
6. Click **Add**
7. **IMPORTANT**: Copy the secret value now - you won't be able to see it again! This is your `AZURE_AD_CLIENT_SECRET`
8. Click **API permissions** in the left sidebar
9. Click **Add a permission**
10. Select **Microsoft Graph**
11. Select **Delegated permissions**
12. Add the following permissions:
    - `User.Read`
    - `email`
    - `openid`
    - `profile`
13. Click **Grant admin consent for [your domain]** (if applicable)

## Step 3: Get Tenant ID (if needed)

1. Go back to **Azure Active Directory** overview
2. Note down the **Tenant ID** - this is your `AZURE_AD_TENANT_ID`

## Step 4: Configure Environment Variables

Update your `.env` file with the values you obtained:

```env
AZURE_AD_CLIENT_ID=your-client-id-here
AZURE_AD_CLIENT_SECRET=your-client-secret-here
AZURE_AD_TENANT_ID=your-tenant-id-here (optional, use common for multitenant)
NEXTAUTH_SECRET=your-secret-key-change-this-in-production
NEXTAUTH_URL=http://localhost:3000
```

**Note**: For multitenant apps, you can set `AZURE_AD_TENANT_ID=common`

## Step 5: Run Migrations

If you haven't already, run the database migration:

```bash
npx prisma migrate dev --name add-nextauth-models
```

## Step 6: Restart Your Dev Server

Your changes should now take effect!
