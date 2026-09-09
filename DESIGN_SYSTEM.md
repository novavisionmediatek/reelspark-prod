# ReelSpark Design System

## Brand Identity

**App Name:** ReelSpark  
**Tagline:** Boost Your Shorts, Spark Your Audience

---

## Color Palette

### Signature Gradient
```
linear-gradient(90deg, #FF651C 0%, #FE4940 25%, #FD3667 48%, #DB3293 70%, #7D27E3 100%)
```

### Primary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Primary Orange | `#FF651C` | Gradient start, highlights, accent |
| Reel Coral | `#FE4940` | Warm accent, hover states |
| Spark Pink | `#FD3667` | Primary CTA, active states, focus |
| Magenta | `#DB3293` | Icons, secondary accents |
| Electric Purple | `#7D27E3` | Gradient end, active states, primary buttons |
| Deep Purple | `#5B18C9` | Gradient depth, emphasis |

### Neutral Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#09090B` | Main page/screen background |
| Card Background | `#141418` | Cards, navbars, modals, input fields |
| Border | `#29292F` | Dividers, input borders, subtle separation |
| Primary Text | `#FFFFFF` | Headings, primary content |
| Secondary Text | `#A6A6B0` | Body copy, metadata, hints |
| Soft Surface | `#F4F4F7` | Light sections, utility surfaces |

---

## Typography

### Font Stack
```
Primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif
Monospace: 'Courier New', monospace (for video IDs, timestamps)
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Display | 32px | 700 | 40px | App title, major headings |
| Heading 1 | 28px | 700 | 36px | Screen titles |
| Heading 2 | 24px | 600 | 32px | Section headers |
| Heading 3 | 20px | 600 | 28px | Card titles, subsections |
| Body Large | 18px | 400 | 28px | Body copy, descriptions |
| Body | 16px | 400 | 24px | Standard body text |
| Body Small | 14px | 400 | 20px | Secondary info, captions |
| Label | 12px | 500 | 16px | Labels, badges, hints |
| Overline | 10px | 600 | 14px | Overlines, emphasis tags |

---

## Spacing System

**Base Unit:** 8px

```
xs: 4px
sm: 8px
md: 12px
lg: 16px
xl: 24px
2xl: 32px
3xl: 48px
4xl: 64px
```

**Standard Padding:**
- Cards: 16px (lg)
- Modals: 24px (xl)
- Screens: 16px (lg)
- Buttons: vertical 12px, horizontal 16px

---

## Component Specifications

### Button Styles

#### Primary Button (Full-width CTA)
```
- Background: Gradient (primary brand)
- Text Color: #FFFFFF
- Padding: 14px 24px
- Border Radius: 12px
- Font: Body (16px, 600 weight)
- Active: Opacity 0.9, slight scale-down (0.98)
- Disabled: Opacity 0.5, no interaction
```

#### Secondary Button (Outline)
```
- Background: Transparent
- Border: 1px solid #29292F
- Text Color: #FFFFFF
- Padding: 14px 24px
- Border Radius: 12px
- Hover: Background #141418, Border #FD3667
```

#### Ghost Button (Minimal)
```
- Background: Transparent
- Text Color: #FD3667
- Padding: 12px 16px
- No border
- Hover: Background rgba(#FD3667, 0.1)
```

#### Icon Button (Circular)
```
- Size: 44px × 44px (minimum touch target)
- Background: #141418
- Icon Color: #FD3667
- Border Radius: 50%
- Active: Background gradient overlay
```

### Input Fields

```
- Background: #141418
- Border: 1px solid #29292F
- Border Radius: 10px
- Padding: 12px 14px
- Text Color: #FFFFFF
- Placeholder: #A6A6B0
- Focus: Border color #FD3667, glow effect
- Error: Border color #FE4940
- Active: Border color #7D27E3, subtle shadow
```

### Cards

```
- Background: #141418
- Border: 1px solid #29292F
- Border Radius: 12px
- Padding: 16px
- Shadow (elevation 1): 0px 2px 8px rgba(0, 0, 0, 0.3)
- Shadow (elevation 2): 0px 4px 16px rgba(0, 0, 0, 0.4)
- Hover: Slight scale-up (1.02), shadow elevation 2
```

### Navigation Bar (Bottom Tabs)

```
- Background: #141418
- Border-Top: 1px solid #29292F
- Height: 64px (safe area included)
- Icon Color: #A6A6B0
- Active Icon: Gradient or #FD3667
- Label Color: #A6A6B0 (12px)
- Active Label: #FFFFFF
```

### Video Feed Card (FlatList Item)

```
- Dimensions: Full width × 600px (aspect ratio for vertical scroll)
- Background: Black with video embed
- Overlay: Bottom gradient overlay (transparent to #09090B)
- Creator Info: Name, platform badge, view count
- Action Buttons: Report, Share positioned in overlay
```

### Status Badges

```
Pending:
- Background: rgba(#DB3293, 0.2)
- Text: #DB3293
- Border: 1px solid #DB3293

Approved:
- Background: rgba(#7D27E3, 0.2)
- Text: #7D27E3
- Border: 1px solid #7D27E3

Rejected:
- Background: rgba(#FE4940, 0.2)
- Text: #FE4940
- Border: 1px solid #FE4940

Flagged:
- Background: rgba(#FF651C, 0.2)
- Text: #FF651C
- Border: 1px solid #FF651C
```

---

## Animation & Motion

### Transitions
```
- Standard (UI, buttons): 200ms ease-out
- Entrance (screens, modals): 300ms ease-out
- Fast (hover, focus): 150ms ease-out
- Slow (full-screen): 400ms ease-out
```

### Interactions
- **Button Press:** Scale 0.98, reduce opacity slightly
- **Card Hover:** Slight lift (translateY -2px), shadow elevation 2
- **Tab Switch:** Fade + slide transition (200ms)
- **Modal Enter:** Slide up from bottom + fade (300ms)
- **Loading:** Pulse or spinner (rotating gradient)

---

## Responsive Breakpoints

| Device Type | Width | Notes |
|-------------|-------|-------|
| Small Phone | 320px | iPhone SE, older devices |
| Standard Phone | 375px | iPhone 12, standard mobile |
| Large Phone | 430px | iPhone 14 Pro Max, Galaxy S22 |
| Tablet | 768px+ | iPad, landscape orientation |

**Mobile-first approach:** All screens designed for 375px baseline, scale up for larger devices.

---

## Icons

**Icon Set:** Feather Icons + custom ReelSpark icons  
**Size Convention:**
- Navigation: 24px
- Buttons: 20px
- Cards: 16px
- Labels: 14px

**Key Icons:**
- Play button (custom gradient)
- Video icon (platform indicator)
- Heart/Like icon
- Share icon
- Report flag icon
- Settings icon
- User profile icon
- Plus/Add icon

---

## Accessibility

- **Color Contrast:** All text meets WCAG AA standard (4.5:1 minimum)
- **Touch Targets:** Minimum 44×44px for interactive elements
- **Focus Indicators:** Visible outline or highlight for keyboard navigation
- **Motion:** Respect `prefers-reduced-motion` for animations
- **Text Sizing:** Support system font size scaling (100%-200%)

---

## Dark Mode (Default)

ReelSpark is dark-first. Light mode is not currently in scope for MVP.

---

## Use Cases by Component

### Auth Screens (Welcome, SignUp, Login, ForgotPassword, CompleteProfile)
- Large primary heading (Display or Heading 1)
- Form inputs with validation
- Primary gradient button for submit
- Secondary text button for "switch to login/signup"
- Minimal, focused design
- Logo centered or top-left

### Main Tab Screens

#### Feed Screen
- Full-screen video cards
- Minimal UI chrome (creator info overlay, action buttons)
- Manual play button centered on thumbnail
- Swipe/scroll affordance hints

#### Submit Screen
- URL input field (prominent)
- Client-side validation indicator
- Metadata preview card (async-loaded)
- Primary submit button (disabled until validated)

#### My Videos Screen
- List/grid of user's submitted videos
- Status badge on each card
- View count displayed
- Tap to edit/delete actions
- Empty state with CTA to submit first video

#### Profile Screen
- User avatar (tappable to edit)
- Display name and bio
- Linked social handles (YouTube, Instagram)
- Account stats (total videos, total in-app views)
- Settings/logout buttons

---

## Quality Checklist

- [ ] All text meets contrast requirements
- [ ] All interactive elements meet 44×44px minimum
- [ ] Animations use appropriate duration (150-400ms)
- [ ] Spacing is consistent (multiples of 8px)
- [ ] Components scale smoothly from 320px to 430px+
- [ ] Colors follow the brand palette exactly
- [ ] Typography hierarchy is clear and readable
- [ ] Borders and shadows are subtle, not distracting
- [ ] Loading and error states are designed
- [ ] Empty states have helpful messaging + CTA
