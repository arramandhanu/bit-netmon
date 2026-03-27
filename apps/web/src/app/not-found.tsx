export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-300">404</h1>
                <p className="text-lg text-muted-foreground mt-2">Page not found</p>
                <a href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">
                    Go to Dashboard
                </a>
            </div>
        </div>
    );
}
