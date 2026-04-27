# AutoGenesis Documentation Website

This directory contains the source code for the AutoGenesis documentation website, which is automatically deployed to GitHub Pages.

## 🌐 Live Site

Visit the live documentation at: **https://microsoft.github.io/AutoGenesis/**

## 🛠️ Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

## 📦 Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 🚀 Deployment

The website is automatically deployed to GitHub Pages when changes are pushed to the `main` branch via GitHub Actions (see [.github/workflows/deploy-docs.yml](../.github/workflows/deploy-docs.yml)).

## 📁 Directory Structure

```
docs/
├── src/              # React source code
│   ├── components/   # React components
│   ├── pages/        # Page components
│   └── App.tsx       # Main app component
├── public/           # Static assets
├── dist/             # Build output (generated)
└── vite.config.ts    # Vite configuration
```

## ⚙️ Configuration

The site is configured with `base: '/AutoGenesis/'` in `vite.config.ts` to work with GitHub Pages subdirectory deployment.

## 🤝 Contributing

When updating the documentation website:

1. Make changes in the `docs/` directory
2. Test locally with `pnpm run dev`
3. Ensure the build succeeds with `pnpm run build`
4. Commit and push to trigger automatic deployment
