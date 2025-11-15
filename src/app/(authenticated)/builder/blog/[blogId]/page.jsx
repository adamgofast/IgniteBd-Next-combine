'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Save, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

/**
 * Blog Builder Page
 * Creates or edits a blog artifact
 */
export default function BlogBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const blogId = params.blogId;
  const isNew = blogId === 'new';
  
  const workPackageId = searchParams.get('workPackageId');
  const itemId = searchParams.get('itemId');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && blogId) {
      loadBlog();
    }
  }, [blogId, isNew]);

  const loadBlog = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/artifacts/blogs/${blogId}`);
      if (response.data?.success) {
        const blog = response.data.blog;
        setTitle(blog.title || '');
        setContent(blog.content || '');
        setAuthor(blog.author || '');
        setPublished(blog.published || false);
      }
    } catch (err) {
      console.error('Error loading blog:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      setSaving(true);
      const companyHQId = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';

      let blog;
      if (isNew) {
        const response = await api.post('/api/artifacts/blogs', {
          companyHQId,
          title,
          content,
          author,
          published,
        });
        blog = response.data.blog;
      } else {
        const response = await api.patch(`/api/artifacts/blogs/${blogId}`, {
          title,
          content,
          author,
          published,
        });
        blog = response.data.blog;
      }

      // If created from work package, link it
      if (isNew && workPackageId && itemId) {
        await api.patch(`/api/workpackages/items/${itemId}/add-artifact`, {
          type: 'BLOG',
          artifactId: blog.id,
        });
        router.push(`/workpackages/${workPackageId}/items/${itemId}`);
      } else {
        router.push(`/builder/blog/${blog.id}`);
      }
    } catch (err) {
      console.error('Error saving blog:', err);
      alert('Failed to save blog');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl bg-white p-8 text-center shadow">
            <p className="text-sm font-semibold text-gray-600">Loading blog...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            {isNew ? 'Create Blog' : 'Edit Blog'}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Blog post title"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Blog content..."
                rows={15}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="published" className="text-sm text-gray-700">
                Published (visible to client)
              </label>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded bg-red-600 px-6 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Blog'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

