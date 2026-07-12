import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-16">
      <h2 className="text-2xl font-semibold mb-2">Page not found</h2>
      <p className="text-slate-500 mb-6">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
      >
        Back to importer
      </Link>
    </div>
  );
}
