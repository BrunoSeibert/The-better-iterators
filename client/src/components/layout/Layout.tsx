import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-neutral-300 text-neutral-950">
      <header className="flex h-[10vh] min-h-[72px] items-center bg-black px-6 text-white">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
            The Better Iterators
          </p>
          <h1 className="text-2xl font-semibold">Topbar</h1>
        </div>
      </header>

      <main className="flex min-h-[90vh]">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[10vh] min-h-[72px] items-center border-b border-neutral-300 bg-neutral-100 px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Feature Block
              </p>
              <h2 className="text-xl font-semibold text-neutral-800">
                Level Selection
              </h2>
            </div>
          </div>

          <div className="flex-1 bg-white px-6 py-8">
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                  Main Area
                </p>
                <p className="mt-3 text-lg font-medium text-neutral-700">
                  Space for your core app features
                </p>
              </div>
            </div>
            <Outlet />
          </div>
        </section>

        <aside className="h-[90vh] min-h-[540px] w-[320px] shrink-0 border-l border-neutral-500 bg-neutral-500 px-6 py-8 text-white lg:w-[380px]">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-200">
            Assistant
          </p>
          <h2 className="mt-3 text-2xl font-semibold">AI Assistant</h2>
          <div className="mt-6 flex h-[calc(100%-5rem)] min-h-[280px] items-center justify-center rounded-2xl border border-white/20 bg-black/10 p-6 text-center text-sm text-neutral-100">
            Right-side panel reserved for the chat interface.
          </div>
        </aside>
      </main>
    </div>
  );
}
