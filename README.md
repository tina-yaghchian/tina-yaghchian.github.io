# Tina Yaghchian Portfolio

The personal portfolio of Tina Yaghchian, a Computer Engineering student at the University of Waterloo, showcasing software engineering, embedded systems, and technical projects.

**Live website:** https://tina-yaghchian.github.io

## Features

- Real-time 3D circuit board in the hero, modelled in three.js, with a flat canvas fallback where WebGL is unavailable
- Skills by project: select hardware, firmware, software, or data and AI to see which work used it
- Project and experience filtering
- Command menu (`⌘K` / `Ctrl+K`) for pages, projects, and quick actions
- Light and dark themes that follow the system setting and remember your choice
- Responsive layouts from phone to wide desktop
- Respects reduced-motion preferences; content stays readable without JavaScript
- Cross-page transitions, optimized WebP images, SEO metadata, sitemap, and a custom 404 page

## Pages

| Page | Contents |
| --- | --- |
| Home | Introduction, skills by project, projects, recent experience |
| Projects | Medicine dispenser, study spot finder, AI study assistant, RC car |
| Experience | Professional, leadership, and campus roles |
| About | Background, education, technical skills |
| Contact | Email, LinkedIn, GitHub |
| Privacy | Privacy policy |

## Built with

HTML, CSS, and vanilla JavaScript with no build step, deployed on GitHub Pages. The one library is [three.js](https://threejs.org) (MIT), self-hosted in `vendor/` and loaded only on the home page. Type is set in Archivo and IBM Plex Mono.

## Repository structure

```
.
├── index.html, projects.html, experience.html, about.html, contact.html, privacy.html, 404.html
├── css/styles.css      Design tokens and all styles
├── js/main.js          Skills explorer, filters, theme, command menu, flat hero fallback
├── js/board3d.js       3D circuit board hero
├── vendor/             three.js r170 and its license
├── images/             Source images
├── images/web/         Optimized WebP images used by the site
├── assets/             Favicon SVG and Apple touch icon
├── favicon.ico
├── .nojekyll           Serves files as is on GitHub Pages
├── robots.txt
└── sitemap.xml
```

## Running locally

```bash
git clone https://github.com/tina-yaghchian/tina-yaghchian.github.io.git
cd tina-yaghchian.github.io
python3 -m http.server 4173
```

Then open http://localhost:4173.

## License

This project is intended as a personal portfolio. The source code may be viewed for educational purposes, but all personal content, images, and project descriptions remain the intellectual property of Tina Yaghchian unless otherwise stated.
