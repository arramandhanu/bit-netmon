import { redirect } from 'next/navigation';

/**
 * Root page — redirects to dashboard.
 * Once auth is implemented, this checks the session first.
 */
export default function RootPage() {
    redirect('/dashboard');
}
