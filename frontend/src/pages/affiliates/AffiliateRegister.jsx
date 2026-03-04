import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Input, Label, Textarea } from '../../components/ui/FormControls.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { http } from '../../api/http.js'

const initial = {
  full_name: '',
  email: '',
  phone: '',
  location_city: '',
  instagram_handle: '',
  tiktok_handle: '',
  youtube_channel: '',
  website: '',
  whatsapp_group_size: '',
  why_affiliate: '',
  how_promote: '',
  estimated_audience_size: '',
  agree_terms: false,
}

export function AffiliateRegister() {
  const [form, setForm] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.agree_terms) {
      toast.error('Please agree to the affiliate terms.')
      return
    }
    setSubmitting(true)
    try {
      await http.post('/affiliates/apply', {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        location_city: form.location_city.trim() || null,
        instagram_handle: form.instagram_handle.trim() || null,
        tiktok_handle: form.tiktok_handle.trim() || null,
        youtube_channel: form.youtube_channel.trim() || null,
        website: form.website.trim() || null,
        whatsapp_group_size: form.whatsapp_group_size.trim() || null,
        why_affiliate: form.why_affiliate.trim() || null,
        how_promote: form.how_promote.trim() || null,
        estimated_audience_size: form.estimated_audience_size.trim() || null,
      })
      toast.success('Application submitted. We’ll review it and email you once approved.')
      navigate('/affiliates', { replace: true })
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Application failed.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link to="/affiliates" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
          ← Back to Affiliates
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Apply to Become an Affiliate</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          We’ll review your application and get back to you. Approved affiliates get access to the dashboard and promo
          codes.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Basic info</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="full_name">Full name *</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  placeholder="Your full name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+233..."
                />
              </div>
              <div>
                <Label htmlFor="location_city">Location (city)</Label>
                <Input
                  id="location_city"
                  name="location_city"
                  value={form.location_city}
                  onChange={handleChange}
                  placeholder="e.g. Accra"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Social & promotion</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="instagram_handle">Instagram handle</Label>
                <Input
                  id="instagram_handle"
                  name="instagram_handle"
                  value={form.instagram_handle}
                  onChange={handleChange}
                  placeholder="@username"
                />
              </div>
              <div>
                <Label htmlFor="tiktok_handle">TikTok handle</Label>
                <Input
                  id="tiktok_handle"
                  name="tiktok_handle"
                  value={form.tiktok_handle}
                  onChange={handleChange}
                  placeholder="@username"
                />
              </div>
              <div>
                <Label htmlFor="youtube_channel">YouTube channel</Label>
                <Input
                  id="youtube_channel"
                  name="youtube_channel"
                  value={form.youtube_channel}
                  onChange={handleChange}
                  placeholder="Channel name or URL"
                />
              </div>
              <div>
                <Label htmlFor="website">Website (optional)</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label htmlFor="whatsapp_group_size">WhatsApp group size (optional)</Label>
                <Input
                  id="whatsapp_group_size"
                  name="whatsapp_group_size"
                  value={form.whatsapp_group_size}
                  onChange={handleChange}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tell us more</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="why_affiliate">Why do you want to become a LocalLink affiliate?</Label>
                <Textarea
                  id="why_affiliate"
                  name="why_affiliate"
                  value={form.why_affiliate}
                  onChange={handleChange}
                  rows={3}
                  placeholder="A few sentences..."
                />
              </div>
              <div>
                <Label htmlFor="how_promote">How do you plan to promote LocalLink?</Label>
                <Textarea
                  id="how_promote"
                  name="how_promote"
                  value={form.how_promote}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. YouTube videos, WhatsApp groups, Instagram..."
                />
              </div>
              <div>
                <Label htmlFor="estimated_audience_size">Estimated audience size?</Label>
                <Input
                  id="estimated_audience_size"
                  name="estimated_audience_size"
                  value={form.estimated_audience_size}
                  onChange={handleChange}
                  placeholder="e.g. 5,000 followers"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="agree_terms"
                checked={form.agree_terms}
                onChange={handleChange}
                className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-400">
                I agree to the <Link to="/affiliate-terms" className="text-emerald-600 underline dark:text-emerald-400">Affiliate Terms</Link>.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
            <Link to="/affiliates">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </Card>
      </form>
    </div>
  )
}
