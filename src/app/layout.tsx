import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'StoryQuest — A world that remembers', description: 'A living story. Your choices, a world that remembers, and an adventure still being written.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f5f3ed' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
