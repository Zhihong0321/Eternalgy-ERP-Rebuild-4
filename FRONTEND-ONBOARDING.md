# Frontend Development Onboarding Guide

## Overview

Welcome to the Eternalgy ERP frontend development team! This document will help you understand our frontend architecture, technology stack, and development practices.

## Technology Stack

### Core Technologies

- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript for better development experience
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing for SPA navigation

### UI Framework & Styling

- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Shadcn/ui** - High-quality, accessible React components built on Radix UI
- **Lucide React** - Beautiful, customizable SVG icons
- **Radix UI** - Low-level UI primitives for building design systems

### State Management

- **Zustand** - Lightweight state management solution
- **React Query/TanStack Query** - Server state management and caching

### Development Tools

- **ESLint** - Code linting and quality enforcement
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── layout/         # Layout components (Sidebar, Header, Footer)
│   │   └── ui/             # Shadcn/ui components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand stores
│   ├── types/              # TypeScript type definitions
│   ├── lib/                # Utility functions and configurations
│   └── assets/             # Static assets
├── public/                 # Public static files
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## Key Components

### Layout System

- **AppLayout** (`src/components/layout/AppLayout.tsx`)
  - Main application layout wrapper
  - Handles responsive design (desktop/mobile)
  - Contains sidebar, header, and main content area

- **Sidebar** (`src/components/layout/Sidebar.tsx`)
  - Navigation menu with gradient styling
  - Collapsible sections for different modules
  - Active state management

- **Footer** (`src/components/layout/Footer.tsx`)
  - Build information and version display
  - Gradient styling with modern aesthetics

### Pages

- **Dashboard** (`src/pages/Dashboard.tsx`)
  - Main dashboard with overview cards
  - System status and metrics display
  - Vibrant gradient design

## Design System

### Color Palette

Our design follows a modern gradient-based color system:

- **Primary Gradients**: Blue to cyan, purple to pink
- **Module Colors**:
  - Dashboard: Blue to cyan
  - Sales: Emerald to teal
  - Inventory: Purple to pink
  - Finance: Orange to red
  - HR: Indigo to purple

### Typography

- **Font Family**: System fonts with fallbacks
- **Font Weights**: Regular (400), Medium (500), Semibold (600), Bold (700)
- **Text Colors**: White, slate variations, gradient text effects

### Component Styling

- **Cards**: Gradient backgrounds with shadows
- **Buttons**: Gradient hover effects
- **Navigation**: Active states with unique gradients per section
- **Interactive Elements**: Smooth transitions and hover effects

## Development Workflow

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Eternalgy_ERP_Rebuild4/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   - Frontend runs on `http://localhost:5173`
   - Backend API runs on `http://localhost:3001`

### Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Environment Configuration

- **Development**: Uses `.env` file with `VITE_API_BASE_URL=http://localhost:3001`
- **Production**: Uses Railway environment variables
- **API Configuration**: Handled in `src/hooks/useEternalgyAPI.ts`

## API Integration

### Custom Hook: useEternalgyAPI

Location: `src/hooks/useEternalgyAPI.ts`

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
```

- Automatically configures API base URL based on environment
- Provides methods for all backend endpoints
- Handles error responses and loading states

### Backend Endpoints

- `/api/sync/status` - Get sync status
- `/api/sync/start` - Start data synchronization
- `/api/schema/current` - Get current schema
- `/api/logs` - Get system logs

## Component Development Guidelines

### Creating New Components

1. **Use TypeScript** - Always define proper types and interfaces
2. **Follow naming conventions** - PascalCase for components, camelCase for functions
3. **Use Tailwind classes** - Prefer utility classes over custom CSS
4. **Implement responsive design** - Use Tailwind responsive prefixes
5. **Add proper accessibility** - Use semantic HTML and ARIA attributes

### Example Component Structure

```typescript
import React from 'react';
import { cn } from '@/lib/utils';

interface ComponentProps {
  title: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

const Component: React.FC<ComponentProps> = ({ 
  title, 
  variant = 'primary', 
  className 
}) => {
  return (
    <div className={cn(
      'base-classes',
      variant === 'primary' && 'primary-classes',
      variant === 'secondary' && 'secondary-classes',
      className
    )}>
      {title}
    </div>
  );
};

export default Component;
```

### Styling Guidelines

1. **Use Tailwind utilities** - Avoid custom CSS when possible
2. **Implement gradients** - Use `bg-gradient-to-r` for consistent styling
3. **Add hover effects** - Use `hover:` prefixes for interactive elements
4. **Maintain spacing** - Use consistent padding and margin classes
5. **Use shadows** - Apply `shadow-lg` for depth

## State Management

### Zustand Stores

Location: `src/stores/`

- **Simple and lightweight** - Minimal boilerplate
- **TypeScript support** - Fully typed stores
- **Devtools integration** - For debugging

Example store structure:

```typescript
import { create } from 'zustand';

interface StoreState {
  data: any[];
  loading: boolean;
  setData: (data: any[]) => void;
  setLoading: (loading: boolean) => void;
}

const useStore = create<StoreState>((set) => ({
  data: [],
  loading: false,
  setData: (data) => set({ data }),
  setLoading: (loading) => set({ loading }),
}));
```

## Testing Strategy

### Testing Tools (Future Implementation)

- **Vitest** - Fast unit testing framework
- **React Testing Library** - Component testing utilities
- **Playwright** - End-to-end testing

### Testing Guidelines

1. **Unit tests** - Test individual components and hooks
2. **Integration tests** - Test component interactions
3. **E2E tests** - Test complete user workflows

## Deployment

### Railway Deployment

- **Configuration**: `railway.toml`
- **Build command**: `npm run build`
- **Environment variables**: Set in Railway dashboard
- **Domain**: Automatically provided by Railway

### Local Testing with Railway Backend

To test local frontend with Railway backend:

1. Update `.env` file:
   ```
   VITE_API_BASE_URL=https://your-railway-backend-url.railway.app
   ```

2. Restart development server:
   ```bash
   npm run dev
   ```

## Common Patterns

### Loading States

```typescript
const [loading, setLoading] = useState(false);

if (loading) {
  return <div className="animate-pulse">Loading...</div>;
}
```

### Error Handling

```typescript
const [error, setError] = useState<string | null>(null);

if (error) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <p className="text-red-800">{error}</p>
    </div>
  );
}
```

### Responsive Design

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Content */}
</div>
```

## Best Practices

### Code Quality

1. **Use TypeScript strictly** - Enable strict mode in tsconfig.json
2. **Follow ESLint rules** - Fix all linting errors before committing
3. **Write meaningful comments** - Explain complex logic
4. **Use descriptive variable names** - Avoid abbreviations
5. **Keep components small** - Single responsibility principle

### Performance

1. **Lazy load routes** - Use React.lazy() for code splitting
2. **Optimize images** - Use appropriate formats and sizes
3. **Minimize bundle size** - Avoid unnecessary dependencies
4. **Use React.memo** - For expensive components
5. **Implement virtualization** - For large lists

### Accessibility

1. **Use semantic HTML** - Proper heading hierarchy
2. **Add ARIA labels** - For screen readers
3. **Ensure keyboard navigation** - Tab order and focus management
4. **Maintain color contrast** - Follow WCAG guidelines
5. **Test with screen readers** - Verify accessibility

## Troubleshooting

### Common Issues

1. **Import errors** - Check file paths and exports
2. **TypeScript errors** - Verify type definitions
3. **Styling issues** - Check Tailwind class names
4. **API connection** - Verify backend is running
5. **Build failures** - Check for syntax errors

### Debug Tools

- **React DevTools** - Component inspection
- **Browser DevTools** - Network and console debugging
- **Vite DevTools** - Build analysis
- **TypeScript compiler** - Type checking

## Resources

### Documentation

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

### Team Communication

- **Code reviews** - All PRs require review
- **Daily standups** - Discuss progress and blockers
- **Documentation updates** - Keep this guide current
- **Knowledge sharing** - Regular tech talks

## Getting Help

1. **Check this documentation** - Most common questions are covered
2. **Review existing code** - Look at similar implementations
3. **Ask team members** - Don't hesitate to reach out
4. **Create GitHub issues** - For bugs or feature requests
5. **Update documentation** - Help improve this guide

---

**Welcome to the team! Happy coding! 🚀**