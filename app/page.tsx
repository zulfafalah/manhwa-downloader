'use client';

import { useState } from "react";

interface Manhwa {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  addedAt: Date;
  fileName?: string;
  fileSize?: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [manhwaList, setManhwaList] = useState<Manhwa[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractTitleFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const title = segments[segments.length - 1] || 'Unknown Manhwa';
      return title.replace(/-/g, ' ').replace(/_/g, ' ');
    } catch {
      return 'Unknown Manhwa';
    }
  };

  const generateFileName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(Boolean);
      const name = segments[segments.length - 1] || 'manhwa';
      return `${name}.zip`;
    } catch {
      return 'manhwa.zip';
    }
  };

  const generateFileSize = (): string => {
    const sizeMB = Math.floor(Math.random() * 150) + 50; // Random size between 50-200 MB
    return `${sizeMB} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) return;

    setIsSubmitting(true);

    const newManhwa: Manhwa = {
      id: Date.now().toString(),
      url: url.trim(),
      title: extractTitleFromUrl(url.trim()),
      status: 'pending',
      progress: 0,
      addedAt: new Date(),
    };

    setManhwaList(prev => [newManhwa, ...prev]);
    setUrl('');

    // Simulate download process
    simulateDownload(newManhwa.id);

    setTimeout(() => setIsSubmitting(false), 300);
  };

  const simulateDownload = (id: string) => {
    // Update status to downloading
    setManhwaList(prev =>
      prev.map(m => m.id === id ? { ...m, status: 'downloading' as const } : m)
    );

    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setManhwaList(prev =>
          prev.map(m => {
            if (m.id === id) {
              return {
                ...m,
                status: 'completed' as const,
                progress: 100,
                fileName: generateFileName(m.url),
                fileSize: generateFileSize()
              };
            }
            return m;
          })
        );
      } else {
        setManhwaList(prev =>
          prev.map(m => m.id === id ? { ...m, progress: Math.floor(progress) } : m)
        );
      }
    }, 500);
  };

  const getStatusColor = (status: Manhwa['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 dark:text-yellow-400';
      case 'downloading': return 'text-blue-600 dark:text-blue-400';
      case 'completed': return 'text-green-600 dark:text-green-400';
      case 'error': return 'text-red-600 dark:text-red-400';
    }
  };

  const getStatusText = (status: Manhwa['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'downloading': return 'Downloading';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-4">
            Manhwa Downloader
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Download your favorite manhwa easily
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-8 mb-8 transition-all hover:shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="manhwa-url" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Manhwa URL
              </label>
              <input
                id="manhwa-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/manhwa/title"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !url.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              {isSubmitting ? 'Adding...' : 'Start Download'}
            </button>
          </form>
        </div>

        {/* Download List */}
        {manhwaList.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-4">
              Download Queue ({manhwaList.length})
            </h2>

            <div className="space-y-3">
              {manhwaList.map((manhwa) => (
                <div
                  key={manhwa.id}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-xl shadow-md border border-slate-200/50 dark:border-slate-700/50 p-6 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg capitalize mb-1">
                        {manhwa.title}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {manhwa.url}
                      </p>
                    </div>
                    <span className={`text-sm font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 ${getStatusColor(manhwa.status)}`}>
                      {getStatusText(manhwa.status)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  {manhwa.status === 'downloading' && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-400">Progress</span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">{manhwa.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${manhwa.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {manhwa.status === 'completed' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">Download completed successfully</span>
                      </div>

                      {/* File Information and Download Button */}
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                              {manhwa.fileName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {manhwa.fileSize}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            // Simulate file download
                            const link = document.createElement('a');
                            link.href = '#';
                            link.download = manhwa.fileName || 'manhwa.zip';
                            alert(`Downloading: ${manhwa.fileName}\nSize: ${manhwa.fileSize}`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Download File
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {manhwaList.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              No manhwa in queue. Add one to get started!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
