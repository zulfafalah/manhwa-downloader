'use client';

import { useState, useEffect, useRef } from "react";

interface Manhwa {
  id: number;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'timeout';
  progress: number;
  addedAt: Date;
  fileName?: string;
  fileSize?: string;
  content?: string;
  zip_file?: string | null;
  zip_file_size_mb?: number;
  created_at?: string;
  updated_at?: string;
  download_status?: string;
  timedOut?: boolean;
  isChecking?: boolean;
}

export default function Home() {
  const pollingIntervalsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const pollingTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const [url, setUrl] = useState('');
  const [manhwaList, setManhwaList] = useState<Manhwa[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load manhwa list from localStorage on component mount
  useEffect(() => {
    const savedManhwaList = localStorage.getItem('manhwaDownloadHistory');
    if (savedManhwaList) {
      try {
        const parsed = JSON.parse(savedManhwaList);
        // Convert date strings back to Date objects
        const manhwaListWithDates = parsed.map((m: Manhwa) => ({
          ...m,
          addedAt: new Date(m.addedAt),
        }));
        setManhwaList(manhwaListWithDates);
      } catch (error) {
        console.error('Error loading manhwa history from localStorage:', error);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save manhwa list to localStorage whenever it changes (after initialization)
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('manhwaDownloadHistory', JSON.stringify(manhwaList));
    }
  }, [manhwaList, isInitialized]);

  // Cleanup polling intervals on component unmount
  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
      pollingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      pollingTimeoutsRef.current.clear();
    };
  }, []);

  const pollManhwaStatus = async (id: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/kokorean/manhwa/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch manhwa status');
      }

      const result = await response.json();
      const data = result.data;

      // Update manhwa in the list
      setManhwaList(prev =>
        prev.map(m => {
          if (m.id === id) {
            // Don't update if already timed out
            if (m.timedOut) return m;
            return {
              ...m,
              title: data.title,
              content: data.content,
              zip_file: data.zip_file,
              zip_file_size_mb: data.zip_file_size_mb,
              updated_at: data.updated_at,
              download_status: data.download_status,
            };
          }
          return m;
        })
      );

      // If zip_file is available, stop polling and mark as completed
      if (data.zip_file) {
        const interval = pollingIntervalsRef.current.get(id);
        if (interval) {
          clearInterval(interval);
          pollingIntervalsRef.current.delete(id);
        }
        const timeout = pollingTimeoutsRef.current.get(id);
        if (timeout) {
          clearTimeout(timeout);
          pollingTimeoutsRef.current.delete(id);
        }

        // Update status to completed
        setManhwaList(prev =>
          prev.map(m => {
            if (m.id === id) {
              return {
                ...m,
                status: 'completed' as const,
                progress: 100,
                timedOut: false,
              };
            }
            return m;
          })
        );
      }
    } catch (error) {
      console.error('Error polling manhwa status:', error);
      // Stop polling on error
      const interval = pollingIntervalsRef.current.get(id);
      if (interval) {
        clearInterval(interval);
        pollingIntervalsRef.current.delete(id);
      }
    }
  };

  const startPolling = (id: number) => {
    // Start polling every 5 seconds
    const interval = setInterval(() => {
      pollManhwaStatus(id);
    }, 5000);

    pollingIntervalsRef.current.set(id, interval);

    // Set timeout for 30 seconds
    const timeout = setTimeout(() => {
      // Stop polling after 30 seconds
      const interval = pollingIntervalsRef.current.get(id);
      if (interval) {
        clearInterval(interval);
        pollingIntervalsRef.current.delete(id);
      }

      // Mark as timed out
      setManhwaList(prev =>
        prev.map(m => {
          if (m.id === id && !m.zip_file) {
            return {
              ...m,
              status: 'timeout' as const,
              timedOut: true,
            };
          }
          return m;
        })
      );
    }, 30000); // 30 seconds

    pollingTimeoutsRef.current.set(id, timeout);
  };

  const checkAndRestorePolling = async (id: number) => {
    try {
      console.log(`[Recovery] Checking status for manhwa ID: ${id}`);

      // Check current status from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/kokorean/manhwa/${id}`);

      if (!response.ok) {
        console.error('Failed to fetch manhwa status for id:', id);
        return;
      }

      const result = await response.json();
      const data = result.data;

      console.log(`[Recovery] API response for ID ${id}:`, {
        has_zip: !!data.zip_file,
        zip_file: data.zip_file,
        title: data.title,
        download_status: data.download_status
      });

      // Update manhwa with latest data from API
      setManhwaList(prev =>
        prev.map(m => {
          if (m.id === id) {
            const updated = {
              ...m,
              title: data.title,
              content: data.content,
              zip_file: data.zip_file,
              zip_file_size_mb: data.zip_file_size_mb,
              updated_at: data.updated_at,
              download_status: data.download_status,
              status: data.zip_file ? 'completed' as const : 'downloading' as const,
              progress: data.zip_file ? 100 : Math.max(90, m.progress), // Keep at 90% minimum while waiting
              timedOut: false, // Reset timeout flag when checking API
            };
            console.log(`[Recovery] Updated manhwa ID ${id}:`, {
              old_status: m.status,
              new_status: updated.status,
              has_zip: !!updated.zip_file,
              progress: updated.progress
            });
            return updated;
          }
          return m;
        })
      );

      // If zip_file is not yet available, restart polling
      if (!data.zip_file) {
        console.log(`[Recovery] Starting polling for ID ${id} (zip not ready)`);
        // Start polling with timeout
        startPolling(id);
      } else {
        console.log(`[Recovery] Zip file ready for ID ${id}, no polling needed`);
      }
    } catch (error) {
      console.error('Error checking manhwa status:', error);
    }
  };

  const handleManualRetry = async (id: number) => {
    try {
      // Set checking state and progress to 90%
      setManhwaList(prev =>
        prev.map(m => {
          if (m.id === id) {
            return {
              ...m,
              isChecking: true,
              status: 'downloading' as const,
              progress: 90, // Set to 90% while checking
              timedOut: false,
            };
          }
          return m;
        })
      );

      // Check and restore polling (which will poll immediately)
      await checkAndRestorePolling(id);

      // Remove checking state after a short delay to show the result
      setTimeout(() => {
        setManhwaList(prev =>
          prev.map(m => {
            if (m.id === id) {
              return {
                ...m,
                isChecking: false,
              };
            }
            return m;
          })
        );
      }, 500);
    } catch (error) {
      console.error('Error retrying download:', error);
      // Remove checking state on error
      setManhwaList(prev =>
        prev.map(m => {
          if (m.id === id) {
            return {
              ...m,
              isChecking: false,
            };
          }
          return m;
        })
      );
    }
  };

  // Restore polling for incomplete items after initialization
  useEffect(() => {
    if (isInitialized && manhwaList.length > 0) {
      console.log('[Recovery] Starting restoration check for', manhwaList.length, 'items');

      manhwaList.forEach(async (manhwa) => {
        // Check items that don't have zip_file yet
        // This includes: pending, downloading, timeout states, AND completed items without zip_file
        if (!manhwa.zip_file) {
          console.log(`[Recovery] Item needs check - ID: ${manhwa.id}, Status: ${manhwa.status}, Title: ${manhwa.title}`);
          await checkAndRestorePolling(manhwa.id);
        } else {
          console.log(`[Recovery] Item already has zip - ID: ${manhwa.id}, Status: ${manhwa.status}`);
        }
      });
    }
  }, [isInitialized]);

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

  const getImageCount = (content?: string): number => {
    if (!content) return 0;
    try {
      const images = JSON.parse(content);
      return Array.isArray(images) ? images.length : 0;
    } catch {
      return 0;
    }
  };

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all download history?')) {
      setManhwaList([]);
      localStorage.removeItem('manhwaDownloadHistory');
      // Clear all active polling intervals and timeouts
      pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
      pollingIntervalsRef.current.clear();
      pollingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      pollingTimeoutsRef.current.clear();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) return;

    setIsSubmitting(true);

    try {
      // Call the API to download manhwa
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/kokorean/manhwa/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          title: '',
          download_status: 'pending',
          content: ''
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to download manhwa');
      }

      const result = await response.json();

      // Create manhwa object from API response
      const newManhwa: Manhwa = {
        id: result.data.id,
        url: result.data.url,
        title: result.data.title,
        status: 'pending',
        progress: 0,
        addedAt: new Date(result.data.created_at),
        content: result.data.content,
        zip_file: result.data.zip_file,
        zip_file_size_mb: result.data.zip_file_size_mb,
        created_at: result.data.created_at,
        updated_at: result.data.updated_at,
        download_status: result.data.download_status,
      };

      setManhwaList(prev => [newManhwa, ...prev]);
      setUrl('');

      // Start polling if zip_file is not yet available
      if (!result.data.zip_file) {
        // Start progress simulation
        simulateDownload(newManhwa.id);

        // Start polling with timeout
        startPolling(newManhwa.id);
      } else {
        // If zip_file is already available, mark as completed
        setManhwaList(prev =>
          prev.map(m => {
            if (m.id === newManhwa.id) {
              return {
                ...m,
                status: 'completed' as const,
                progress: 100,
              };
            }
            return m;
          })
        );
      }
    } catch (error) {
      console.error('Error downloading manhwa:', error);
      alert('Failed to download manhwa. Please check the URL and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const simulateDownload = (id: number) => {
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
      case 'timeout': return 'text-orange-600 dark:text-orange-400';
    }
  };

  const getStatusText = (status: Manhwa['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'downloading': return 'Downloading';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      case 'timeout': return 'Processing';
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
                placeholder="https://뉴토끼대피소.com/chapter/1123586"
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                Download Queue ({manhwaList.length})
              </h2>
              <button
                onClick={clearHistory}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Clear History
              </button>
            </div>

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
                          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                          style={{ width: `${manhwa.progress}%` }}
                        >
                          {/* Animated shimmer effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timeout State with Manual Retry */}
                  {manhwa.status === 'timeout' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-orange-900 dark:text-orange-200 mb-1">
                            File masih dalam proses
                          </p>
                          <p className="text-xs text-orange-700 dark:text-orange-300">
                            File ini berukuran besar dan masih membutuhkan waktu untuk diproses. Klik tombol di bawah secara berkala untuk memeriksa status download.
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleManualRetry(manhwa.id)}
                        disabled={manhwa.isChecking}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {manhwa.isChecking ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Memeriksa...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                            </svg>
                            Cek Status Download
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {manhwa.status === 'completed' && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">Download completed successfully</span>
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">
                          {getImageCount(manhwa.content)} images
                        </span>
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
                              {manhwa.zip_file ? manhwa.zip_file.split('/').pop() : 'Processing...'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {manhwa.zip_file && manhwa.zip_file_size_mb
                                ? `${manhwa.zip_file_size_mb.toFixed(2)} MB`
                                : '0 MB'
                              }
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (manhwa.zip_file) {
                              // Download the actual zip file
                              const link = document.createElement('a');
                              link.href = manhwa.zip_file;
                              link.download = manhwa.zip_file.split('/').pop() || 'manhwa.zip';
                              link.target = '_blank';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                          disabled={!manhwa.zip_file}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {!manhwa.zip_file ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Preparing...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                              Download File
                            </>
                          )}
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
