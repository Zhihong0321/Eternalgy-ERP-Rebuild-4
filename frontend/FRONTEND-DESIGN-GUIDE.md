# Eternalgy ERP Frontend Design System & Style Guide

## 🎨 Layout Architecture

### Core Layout Structure
```
AppLayout (Full Screen Container)
├── Gradient Background (radial-gradient)
├── Sidebar (45% transparency)
└── Main Content Area (Full Width)
    └── Individual Pages (Internal padding: p-8)
```

## 📐 Layout Rules

### 1. **Full-Width Layout Strategy**
- ✅ **DO**: Content stretches full viewport width
- ✅ **DO**: Apply padding INSIDE individual pages (`p-8`)
- ❌ **DON'T**: Use max-width containers that center content
- ❌ **DON'T**: Add padding at the AppLayout level

### 2. **Page Structure Template**
```tsx
const YourPage = () => {
  return (
    <div className="p-8 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Page Title</h1>
          <p className="text-muted-foreground">Page description</p>
        </div>
        <Button variant="outline">Action Button</Button>
      </div>
      
      {/* Content Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Section Title</CardTitle>
          <CardDescription>Section description</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Content here */}
        </CardContent>
      </Card>
    </div>
  );
};
```

### 3. **Background Rules**
- ✅ **DO**: Let the gradient background show through
- ✅ **DO**: Use transparent/semi-transparent cards (`bg-white/80`, `bg-white/90`)
- ❌ **DON'T**: Add solid background colors to page containers
- ❌ **DON'T**: Override the gradient with solid backgrounds

## 🎭 Visual Design System

### Typography System
```css
/* Font Families */
- Headings/Titles: font-heading (Oxanium)
- Body Text: font-body (Inter) - DEFAULT
- UI Elements: Inter by default

/* Usage Classes */
- Page titles: font-heading font-bold text-3xl
- Section headers: font-heading font-semibold text-lg
- Card titles: font-heading font-semibold
- Body text: Uses Inter automatically
- Navigation: font-heading for section headers, Inter for items
```

### Color Palette
```css
/* Primary Gradient Background */
bg-[radial-gradient(1200px_600px_at_10%_10%,_#eaf2fb_0%,_#f7fafc_40%),_radial-gradient(1200px_700px_at_90%_90%,_#eef6f0_0%,_#f7fafc_45%)]

/* Card Backgrounds */
- Primary: bg-white (solid cards)
- Secondary: bg-white/80 (semi-transparent)
- Tertiary: bg-white/90 (more opaque)

/* Text Colors */
- Headers: text-gray-900 (with font-heading)
- Body: text-gray-600, text-gray-500 (with font-body)
- Muted: text-muted-foreground
```

### Card Design Patterns
```tsx
// Standard Card
<Card className="bg-white border border-gray-200 shadow-lg">

// Transparent Card (preferred for main content)
<Card className="bg-white/80 backdrop-blur rounded-xl border border-slate-200 shadow-sm">

// Gradient Cards (for special content)
<Card className="bg-gradient-to-br from-[#cfdcf3] to-[#dae4f6] text-slate-900">
```

## 🧩 Component Standards

### Headers
```tsx
// Page Header Pattern (with Oxanium font)
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-3xl font-heading font-bold tracking-tight">Title</h1>
    <p className="text-muted-foreground">Description</p>
  </div>
  <Button variant="outline">Action</Button>
</div>
```

### Section Headers
```tsx
// Section Header with Actions (with Oxanium font)
<div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-heading font-semibold text-gray-900">Section Title</h2>
  <div className="flex items-center space-x-2">
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </div>
</div>
```

### Spacing System
- **Page padding**: `p-8` (32px all around)
- **Section spacing**: `space-y-6` (24px between sections)
- **Card internal padding**: `p-6` (24px)
- **Small elements**: `p-2`, `p-3`, `p-4`

## 🎯 Sidebar Specifications

### Current Settings
```tsx
// Sidebar transparency and styling
<div className="flex h-full w-[280px] flex-col bg-white/45 backdrop-blur-xl">
```

### Build Info Footer
```tsx
// Always include in sidebar
<div className="border-t border-slate-200/50 px-4 py-3">
  <div className="text-[10px] text-slate-500 font-medium">
    <div className="flex items-center justify-between">
      <span>Build</span>
      <span className="text-slate-400">{version}</span>
    </div>
    <div className="mt-1 text-slate-400">{buildTime}</div>
  </div>
</div>
```

## 📋 Page Implementation Checklist

### For Every New Page:
- [ ] Use `p-8 space-y-6` as root container classes
- [ ] Include proper page header with title and description
- [ ] Use semi-transparent cards where appropriate
- [ ] No solid background colors on page container
- [ ] Include loading and error states
- [ ] Use consistent button styling and spacing
- [ ] Follow the component patterns above

### For Dashboard-Style Pages with Headers:
```tsx
// Special header bar pattern (like Dashboard)
<div className="bg-white border-b border-gray-200 px-8 py-4">
  <div className="flex items-center justify-between">
    {/* Header content */}
  </div>
</div>
<div className="p-8 space-y-6">
  {/* Main content */}
</div>
```

## 🛠 Technical Implementation

### Import Standards
```tsx
// Required imports for most pages
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
```

### TypeScript Patterns
```tsx
// Page component structure
interface PageProps {
  // Define props if needed
}

const PageName = ({ }: PageProps) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // API calls
  const { someAPI, loading: apiLoading, error: apiError } = useEternalgyAPI();
  
  return (
    <div className="p-8 space-y-6">
      {/* Page content */}
    </div>
  );
};

export default PageName;
```

## 🎨 Visual Examples

### Good Layout Examples:
- Dashboard.tsx - Full-width with header bar
- DataSync.tsx - Standard page layout
- DataBrowser.tsx - Complex page with multiple sections

### Key Visual Principles:
1. **Gradient Background Visibility**: Always show the beautiful gradient
2. **Transparency Layers**: Use glass-morphism effects with backdrop-blur
3. **Consistent Spacing**: Follow the p-8, space-y-6 pattern
4. **Professional Cards**: Mix solid and transparent cards appropriately

## 🔄 Future Development Notes

### When Adding New Pages:
1. Copy the page structure template above
2. Follow the component patterns
3. Test with the gradient background visible
4. Ensure sidebar transparency works well
5. Use the same spacing system

### When Modifying Layout:
1. Always preserve the full-width approach
2. Maintain the gradient background visibility  
3. Keep sidebar at 45% transparency
4. Preserve the build info footer

---

## 🎯 Quick Reference for AI Agents

**Essential Classes for New Pages:**
- Root container: `p-8 space-y-6`
- Page headers: `text-3xl font-heading font-bold tracking-tight`
- Section headers: `text-lg font-heading font-semibold`
- Card titles: `font-heading font-semibold`
- Cards: `bg-white/80 backdrop-blur rounded-xl`
- Never use: `max-width`, `mx-auto`, `bg-gray-50`

**Always Remember:**
- Full viewport width content ✅
- Internal padding only ✅  
- Transparent/semi-transparent cards ✅
- Let the gradient show through ✅
- 45% sidebar transparency ✅
