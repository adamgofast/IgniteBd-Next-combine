// Layout config to force dynamic rendering for this route
// This prevents Next.js from trying to statically generate pages in this directory
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function ResultsLayout({ children }) {
  return children;
}

