# Compazz POS - Financial Management
 
A modern financial management and POS application built with React, TypeScript, and Tailwind CSS.
 
## Features
 
- 📊 Dashboard with financial overview
- 🛒 Point of Sale (POS) system
- 🧾 Invoice management (create, view, edit)
- 💰 Expense tracking
- 📈 Daily reports
- 👥 Vendor and customer management
- 🔍 Audit trail
- ⚙️ Settings management
- 🌙 Dark mode support
- 📱 Responsive design
 
## Tech Stack
 
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Routing**: React Router DOM
- **State Management**: React hooks
- **UI Components**: Custom component library
 
## Getting Started
 
### Prerequisites
 
- Node.js 18+ 
- npm or yarn
 
### Installation
 
1. Clone the repository:
```bash
git clone <repository-url>
cd compazz-pos
```

2. Install dependencies:
```bash
# Using npm
npm install

# Using yarn (recommended for Apple Silicon Macs)
yarn install
```

### Development

Start the development server:
```bash
# Using npm
npm run dev

# Using yarn
yarn dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
# Using npm
npm run build

# Using yarn
yarn build
```

### Linting

```bash
# Using npm
npm run lint

# Using yarn
yarn lint
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── dashboard/      # Dashboard-specific components
│   ├── invoice/        # Invoice-related components
│   ├── layout/         # Layout components (Header, Sidebar)
│   └── ui/            # Base UI components
├── pages/              # Page components
│   ├── dashboard/      # Dashboard page
│   ├── invoices/       # Invoice management pages
│   ├── expenses/       # Expense management pages
│   ├── reports/        # Reporting pages
│   └── ...            # Other pages
├── lib/                # Utility functions and data
├── types/              # TypeScript type definitions
└── index.css           # Global styles
```

## Troubleshooting

### Apple Silicon Mac Issues

If you encounter Rollup/architecture-related errors on Apple Silicon Macs:

1. Remove existing dependencies:
```bash
rm -rf node_modules package-lock.json
```

2. Use yarn instead of npm:
```bash
yarn install
yarn dev
```

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is private and proprietary.


