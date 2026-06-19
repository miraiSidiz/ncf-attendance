# QR Attendance System

A student attendance management system that uses QR codes for quick and easy attendance tracking.

## Features

- Student management with QR code generation
- Event creation with start and end times
- QR code scanning for attendance
- Attendance reports with statuses:
  - Present
  - Late
  - Absent
  - Early Leave
- User management (Admin and Scanner roles)

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up Prisma and generate the database:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Register an Admin Account**: On your first visit, go to the login page and click "Don't have an account? Register" to create an admin account.

2. **Add Students**: Navigate to the "Students" page and add students with their details and optional photo URL.

3. **Create Events**: Go to the "Events" page to create events with start and end dates/times.

4. **Scan QR Codes**: On the "Scan QR" page, select an event and click "Start Scanning" to scan student QR codes.

5. **View Reports**: Go to the "Reports" page to view attendance reports for specific events.

6. **Manage Users**: As an admin, you can add new users (Scanner or Admin roles) from the "Users" page.

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite
- qrcode.react
- @zxing/library
