"use client";

import { UploadButton } from "@uploadthing/react";
import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import api from "@/lib/api";

export default function UploadsPage() {
  const [uploaded, setUploaded] = useState([]);
  const [existingUploads, setExistingUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch existing uploads
    const fetchUploads = async () => {
      try {
        // Get ownerId from localStorage or use "joel" as default
        const ownerId = localStorage.getItem("ownerId") || "joel";
        const response = await api.get(`/api/uploads?ownerId=${ownerId}`);
        if (response.data?.success) {
          setExistingUploads(response.data.uploads || []);
        }
      } catch (error) {
        console.error("Error fetching uploads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, []);

  const handleUploadComplete = (res) => {
    console.log("Upload complete:", res);
    setUploaded(res || []);
    // Refresh the list
    window.location.reload();
  };

  const allUploads = [...uploaded, ...existingUploads];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <PageHeader
          title="Client Upload Container"
          subtitle="Upload and manage client files (CSV, XLSX, PDF, Images)"
          backTo="/growth-dashboard"
          backLabel="Back to Growth Dashboard"
        />

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow">
          <div className="mb-6">
            <UploadButton
              endpoint="clientUpload"
              onClientUploadComplete={handleUploadComplete}
              onUploadError={(error) => alert(`Error: ${error.message}`)}
            />
          </div>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading uploads...</p>
            </div>
          ) : allUploads.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Uploaded Files</h2>
              <ul className="divide-y divide-gray-200">
                {allUploads.map((file, index) => (
                  <li key={file.key || file.id || index} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {file.fileType?.startsWith("image/") ? (
                          <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <a
                          href={file.url || file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          {file.name || file.originalName}
                        </a>
                        {file.size && (
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">
                      {file.createdAt
                        ? new Date(file.createdAt).toLocaleDateString()
                        : "Just now"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No files uploaded yet. Use the button above to upload files.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

