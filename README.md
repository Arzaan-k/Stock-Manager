# Stock Manager

A comprehensive stock and inventory management system with purchase order generation and WhatsApp integration.

## Features

- **Inventory Management**: Track products, quantities, and stock levels
- **Purchase Orders**: Generate and manage purchase orders with PDF export
- **Supplier Management**: Maintain supplier information and contact details
- **Order Tracking**: Monitor orders from creation to fulfillment
- **WhatsApp Integration**: Send order updates via WhatsApp
- **PDF Generation**: Automatically generate professional PDF purchase orders

## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **PDF Generation**: PDFKit
- **Styling**: Tailwind CSS

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- PostgreSQL
- Git

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Arzaan-k/Stock-Manager.git
   cd Stock-Manager
   ```

2. Install dependencies:
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   
   # Install server dependencies
   cd server
   npm install
   cd ..
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Copy the contents from `.env.example` and update with your configuration

4. Set up the database:
   - Create a PostgreSQL database
   - Update the database connection string in `.env`
   - Run migrations:
     ```bash
     cd server
     npx drizzle-kit push:pg
     ```

## Running the Application

1. Start the development server:
   ```bash
   # From the root directory
   npm run dev
   ```

2. The application will be available at:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

## Project Structure

```
.
├── client/                 # Frontend React application
├── server/                 # Backend Node.js/Express server
│   ├── services/           # Business logic and services
│   └── routes.ts           # API routes
├── shared/                 # Shared types and utilities
├── migrations/             # Database migrations
└── .env                   # Environment variables
```

## Usage

1. **Add Products**: Navigate to the Products page and add your inventory items
2. **Create Orders**: Create new purchase orders and add products to them
3. **Generate PO**: Generate and download PDF purchase orders
4. **Manage Inventory**: Update stock levels and track inventory

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For any questions or feedback, please contact [Your Email] or open an issue on GitHub.
