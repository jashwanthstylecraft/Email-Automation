import { create } from 'zustand';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  signature: string | null;
}

export interface Email {
  id: string;
  sender: string;
  recipient: string;
  cc?: string | null;
  subject: string;
  body: string;
  preview: string;
  status: 'UNREAD' | 'WAITING' | 'REPLIED' | 'ESCALATED' | 'SPAM';
  isRead: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'ANGRY';
  category: string;
  language: string;
  aiConfidence: number;
  spam: boolean;
  duplicate: boolean;
  summary?: string;
  matchedTemplateId?: string | null;
  aiProvider?: string;
  userFeedback?: string | null;
  userFeedbackNotes?: string | null;
  assignedUserId?: string;
  createdAt: string;
  autoReplies?: any[];
  customer?: { id: string; email: string; totalEmails: number; totalReplies: number; lastEmailAt: string | null } | null;
}

export interface Settings {
  systemPrompt: string;
  tone: string;
  greeting: string;
  closing: string;
  autoReplyMode: 'AUTO' | 'DRAFT' | 'MANUAL';
  confidenceThreshold: number;
}

export interface ConnectedInbox {
  emailAddress: string;
  provider: string;
  status: string;
}

export interface Rule {
  id: string;
  name: string;
  conditions: string;
  actions: string;
  active: boolean;
  triggerCount?: number;
  lastTriggeredAt?: string | null;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string;
  keywords?: string;
  images?: string;
  active?: boolean;
  notes?: string | null;
}

export interface Integration {
  id: string;
  type: string;
  config: string;
  active: boolean;
}

interface AppState {
  user: UserSession | null;
  emails: Email[];
  selectedEmail: Email | null;
  settings: Settings | null;
  connectedInbox: ConnectedInbox | null;
  rules: Rule[];
  documents: Document[];
  templates: Template[];
  integrations: Integration[];
  dashboardMetrics: any;
  dashboardCharts: any;
  recentActivity: any[];
  recentFailedMatches: any[];
  recentChanges: any[];
  dashboardUpdatedAt: number | null;
  isDashboardLoading: boolean;
  isDashboardRefreshing: boolean;
  dashboardError: string | null;
  isLoading: boolean;
  error: string | null;
  lastEmailFilters: any;

  fetchSession: () => Promise<void>;
  logout: () => Promise<void>;
  fetchDashboard: (opts?: { silent?: boolean }) => Promise<void>;
  fetchEmails: (filters?: any) => Promise<void>;
  selectEmail: (email: Email | null) => void;
  syncInbox: () => Promise<{ success: boolean; error?: string; syncedCount?: number; isLive?: boolean }>;
  approveDraft: (emailId: string) => Promise<void>;
  rejectDraft: (emailId: string) => Promise<void>;
  saveDraftEdits: (emailId: string, text: string) => Promise<void>;
  regenerateDraft: (emailId: string, tone: string) => Promise<boolean>;
  sendCustomReply: (emailId: string, text: string) => Promise<void>;
  resendReply: (emailId: string, text: string) => Promise<boolean>;
  changeEmailStatus: (emailId: string, status: string) => Promise<void>;
  markAsUnread: (emailId: string) => Promise<void>;
  deleteEmail: (emailId: string) => Promise<void>;
  archiveEmail: (emailId: string) => Promise<void>;
  assignEmailUser: (emailId: string, userId: string) => Promise<void>;
  fetchRules: () => Promise<void>;
  saveRule: (rule: Omit<Rule, 'id'> & { id?: string }) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  fetchSettings: () => Promise<void>;
  saveSettings: (settings: Settings) => Promise<void>;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (doc: { title: string; content: string; fileType: string }) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  fetchTemplates: () => Promise<void>;
  saveTemplate: (template: Omit<Template, 'id'> & { id?: string }) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  fetchIntegrations: () => Promise<void>;
  saveIntegration: (integration: any) => Promise<void>;
  auditLogs: any[];
  fetchAuditLogs: () => Promise<void>;
  analyzeReferenceFile: (documentId?: string) => Promise<{ success: boolean; templatesCount: number; rulesCount: number } | null>;
  notes: any[];
  fetchNotes: (filters?: { search?: string; templateId?: string; userId?: string }) => Promise<void>;
  saveNote: (note: { id?: string; title: string; noteBody: string; relatedTemplateId?: string | null; relatedEmailId?: string | null; isPinned?: boolean }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  failedMatches: any[];
  fetchFailedMatches: (filters?: { status?: string; templateId?: string; sender?: string }) => Promise<void>;
  updateFailedMatch: (id: string, data: { status?: string; notes?: string }) => Promise<void>;
  editedDrafts: any[];
  fetchEditedDrafts: (filters?: { status?: string; editedBy?: string; sender?: string }) => Promise<void>;
  customers: any[];
  fetchCustomers: (search?: string) => Promise<void>;
  auditLogsFull: any[];
  fetchAuditLogsFull: (filters?: { userId?: string; action?: string; entityType?: string }) => Promise<void>;
  workload: any[];
  fetchWorkload: () => Promise<void>;
  b2bSenders: any[];
  fetchB2BSenders: () => Promise<void>;
  addB2BSender: (value: string) => Promise<boolean>;
  deleteB2BSender: (id: string) => Promise<void>;
  updateSignature: (signature: string) => Promise<boolean>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  emails: [],
  selectedEmail: null,
  settings: null,
  connectedInbox: null,
  rules: [],
  documents: [],
  templates: [],
  integrations: [],
  dashboardMetrics: null,
  dashboardCharts: null,
  recentActivity: [],
  recentFailedMatches: [],
  recentChanges: [],
  dashboardUpdatedAt: null,
  isDashboardLoading: false,
  isDashboardRefreshing: false,
  dashboardError: null,
  isLoading: false,
  error: null,
  lastEmailFilters: null,
  auditLogs: [],
  notes: [],
  failedMatches: [],
  editedDrafts: [],
  customers: [],
  auditLogsFull: [],
  workload: [],
  b2bSenders: [],

  fetchSession: async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        set({ user: data.user });
      }
    } catch (err) {
      console.error('Session fetch failed', err);
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      set({ user: null, emails: [], selectedEmail: null });
    } catch (err) {
      console.error('Logout failed', err);
    }
  },

  fetchDashboard: async (opts = {}) => {
    const user = get().user;
    if (!user) return;
    // Avoid overlapping requests (e.g. a slow poll tick colliding with a manual refresh)
    if (get().isDashboardLoading || get().isDashboardRefreshing) return;

    const { silent = false } = opts;
    set(silent ? { isDashboardRefreshing: true } : { isDashboardLoading: true });
    try {
      const res = await fetch(`/api/dashboard?orgId=${user.organizationId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Dashboard request failed (${res.status})`);
      }
      set({
        dashboardMetrics: data.metrics,
        dashboardCharts: data.charts,
        recentActivity: data.recentActivity,
        recentFailedMatches: data.recentFailedMatches || [],
        recentChanges: data.recentChanges || [],
        dashboardUpdatedAt: Date.now(),
        isDashboardLoading: false,
        isDashboardRefreshing: false,
        dashboardError: null,
      });
    } catch (err: any) {
      set({
        dashboardError: err.message || 'Connection lost while refreshing the dashboard.',
        isDashboardLoading: false,
        isDashboardRefreshing: false,
      });
    }
  },

  fetchEmails: async (filters) => {
    const user = get().user;
    if (!user) return;
    // No-arg refreshes (after approve/archive/etc.) reuse the last explicit
    // filters so the list stays on the tab the user is looking at. The
    // default view is INBOX: only active/upcoming mail that needs action.
    const effective = filters ?? get().lastEmailFilters ?? {};
    set({ isLoading: true, lastEmailFilters: effective });
    try {
      const params = new URLSearchParams({
        orgId: user.organizationId,
        status: effective.status || 'INBOX',
        priority: effective.priority || 'ALL',
        sentiment: effective.sentiment || 'ALL',
        category: effective.category || 'ALL',
        businessType: effective.businessType || 'ALL',
        search: effective.search || '',
      });
      const res = await fetch(`/api/inbox?${params}`);
      const data = await res.json();
      set({ emails: data.emails, isLoading: false });
      
      // Keep selected email updated. It may have fallen out of the current
      // filtered view -- e.g. it just transitioned to REPLIED while viewing
      // the INBOX-only tab -- so fetch its own detail directly rather than
      // leaving the open panel stuck showing pre-action data.
      const selected = get().selectedEmail;
      if (selected) {
        const updatedSelected = data.emails.find((e: Email) => e.id === selected.id);
        if (updatedSelected) {
          set({ selectedEmail: updatedSelected });
        } else {
          fetch(`/api/inbox/${selected.id}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.email && get().selectedEmail?.id === selected.id) {
                set({ selectedEmail: d.email });
              }
            })
            .catch(() => {});
        }
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  selectEmail: (email) => {
    // Mark read immediately (optimistic -- the GET /api/inbox/[id] the inbox
    // page fires right after this persists it server-side) so the bold/thin
    // list styling updates the instant an agent opens the email, not after
    // a round trip.
    if (email && !email.isRead) {
      const patched: Email = { ...email, isRead: true };
      set((state) => ({
        selectedEmail: patched,
        emails: state.emails.map((e) => (e.id === email.id ? patched : e)),
      }));
      return;
    }
    set({ selectedEmail: email });
  },

  syncInbox: async () => {
    const user = get().user;
    if (!user) return { success: false, error: 'Not logged in' };
    set({ isLoading: true });
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: user.organizationId }),
      });
      const data = await res.json();
      if (res.ok) {
        await get().fetchEmails();
        await get().fetchDashboard();
        set({ isLoading: false });
        return { success: true, syncedCount: data.syncedCount, isLive: data.isLive };
      }
      set({ isLoading: false, error: data.error });
      return { success: false, error: data.error || 'Sync failed' };
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return { success: false, error: err.message };
    }
  },

  approveDraft: async (emailId) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (res.ok) {
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  rejectDraft: async (emailId) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT' }),
      });
      if (res.ok) {
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveDraftEdits: async (emailId, text) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'EDIT_DRAFT', responseBody: text }),
      });
      if (res.ok) {
        await get().fetchEmails();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  regenerateDraft: async (emailId, tone) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REGENERATE', tone }),
      });
      const data = await res.json();
      if (res.ok) {
        await get().fetchEmails();
        return true;
      }
      set({ error: data.error });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  sendCustomReply: async (emailId, text) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SEND_CUSTOM', responseBody: text }),
      });
      if (res.ok) {
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resendReply: async (emailId, text) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESEND', responseBody: text }),
      });
      const data = await res.json();
      if (res.ok) {
        await get().fetchEmails();
        return true;
      }
      set({ error: data.error });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  changeEmailStatus: async (emailId, status) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHANGE_STATUS', status }),
      });
      if (res.ok) {
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  markAsUnread: async (emailId) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MARK_UNREAD' }),
      });
      if (res.ok) {
        set((state) => ({
          emails: state.emails.map((e) => (e.id === emailId ? { ...e, isRead: false } : e)),
          selectedEmail: state.selectedEmail?.id === emailId ? { ...state.selectedEmail, isRead: false } : state.selectedEmail,
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteEmail: async (emailId) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        set({ selectedEmail: null });
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  archiveEmail: async (emailId) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ARCHIVE' }),
      });
      if (res.ok) {
        set({ selectedEmail: null });
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  assignEmailUser: async (emailId, userId) => {
    try {
      const res = await fetch(`/api/inbox/${emailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ASSIGN_USER', assignedUserId: userId }),
      });
      if (res.ok) {
        await get().fetchEmails();
        await get().fetchDashboard();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchRules: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/rules?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ rules: data.rules });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveRule: async (rule) => {
    const user = get().user;
    if (!user) return;
    try {
      const method = rule.id ? 'PUT' : 'POST';
      const res = await fetch('/api/rules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, organizationId: user.organizationId }),
      });
      if (res.ok) {
        await get().fetchRules();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteRule: async (id) => {
    try {
      const res = await fetch(`/api/rules?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await get().fetchRules();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchSettings: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/settings?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ settings: data.settings, connectedInbox: data.inbox || null });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveSettings: async (settings) => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, organizationId: user.organizationId }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ settings: data.settings });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchDocuments: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/knowledge?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ documents: data.documents });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  uploadDocument: async (doc) => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...doc, organizationId: user.organizationId }),
      });
      if (res.ok) {
        await get().fetchDocuments();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteDocument: async (id) => {
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await get().fetchDocuments();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchTemplates: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/templates?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ templates: data.templates });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveTemplate: async (tmpl) => {
    const user = get().user;
    if (!user) return;
    try {
      const method = tmpl.id ? 'PUT' : 'POST';
      const res = await fetch('/api/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tmpl, organizationId: user.organizationId }),
      });
      if (res.ok) {
        await get().fetchTemplates();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteTemplate: async (id) => {
    try {
      const res = await fetch(`/api/templates?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        await get().fetchTemplates();
      } else {
        set({ error: data.error || 'Failed to delete template' });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchIntegrations: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/integrations?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ integrations: data.integrations });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveIntegration: async (integration) => {
    const user = get().user;
    if (!user) return;
    try {
      const method = integration.id ? 'PUT' : 'POST';
      const res = await fetch('/api/integrations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...integration, organizationId: user.organizationId }),
      });
      if (res.ok) {
        await get().fetchIntegrations();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchAuditLogs: async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      set({ auditLogs: data.logs || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchNotes: async (filters = {}) => {
    const user = get().user;
    if (!user) return;
    try {
      const params = new URLSearchParams({ orgId: user.organizationId });
      if (filters.search) params.set('search', filters.search);
      if (filters.templateId) params.set('templateId', filters.templateId);
      if (filters.userId) params.set('userId', filters.userId);
      const res = await fetch(`/api/notes?${params}`);
      const data = await res.json();
      set({ notes: data.notes || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  saveNote: async (note) => {
    const user = get().user;
    if (!user) return;
    try {
      const method = note.id ? 'PUT' : 'POST';
      const url = note.id ? `/api/notes/${note.id}` : '/api/notes';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...note, organizationId: user.organizationId }),
      });
      if (res.ok) {
        await get().fetchNotes();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteNote: async (id) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchNotes();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchB2BSenders: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/b2b-senders?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ b2bSenders: data.b2bSenders || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addB2BSender: async (value) => {
    const user = get().user;
    if (!user) return false;
    try {
      const res = await fetch('/api/b2b-senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, organizationId: user.organizationId }),
      });
      const data = await res.json();
      if (res.ok) {
        await get().fetchB2BSenders();
        return true;
      }
      set({ error: data.error });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  deleteB2BSender: async (id) => {
    try {
      const res = await fetch(`/api/b2b-senders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchB2BSenders();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateSignature: async (signature) => {
    const user = get().user;
    if (!user) return false;
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature }),
      });
      const data = await res.json();
      if (res.ok) {
        set({ user: { ...user, signature: data.user.signature } });
        return true;
      }
      set({ error: data.error });
      return false;
    } catch (err: any) {
      set({ error: err.message });
      return false;
    }
  },

  fetchFailedMatches: async (filters = {}) => {
    const user = get().user;
    if (!user) return;
    try {
      const params = new URLSearchParams({ orgId: user.organizationId });
      if (filters.status) params.set('status', filters.status);
      if (filters.templateId) params.set('templateId', filters.templateId);
      if (filters.sender) params.set('sender', filters.sender);
      const res = await fetch(`/api/failed-matches?${params}`);
      const data = await res.json();
      set({ failedMatches: data.failedMatches || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateFailedMatch: async (id, data) => {
    try {
      const res = await fetch(`/api/failed-matches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await get().fetchFailedMatches();
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchEditedDrafts: async (filters = {}) => {
    const user = get().user;
    if (!user) return;
    try {
      const params = new URLSearchParams({ orgId: user.organizationId });
      if (filters.status) params.set('status', filters.status);
      if (filters.editedBy) params.set('editedBy', filters.editedBy);
      if (filters.sender) params.set('sender', filters.sender);
      const res = await fetch(`/api/edited-drafts?${params}`);
      const data = await res.json();
      set({ editedDrafts: data.editedDrafts || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchCustomers: async (search) => {
    const user = get().user;
    if (!user) return;
    try {
      const params = new URLSearchParams({ orgId: user.organizationId });
      if (search) params.set('search', search);
      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      set({ customers: data.customers || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchAuditLogsFull: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.action) params.set('action', filters.action);
      if (filters.entityType) params.set('entityType', filters.entityType);
      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      set({ auditLogsFull: data.logs || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchWorkload: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const res = await fetch(`/api/users/workload?orgId=${user.organizationId}`);
      const data = await res.json();
      set({ workload: data.workload || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  analyzeReferenceFile: async (documentId) => {
    const user = get().user;
    if (!user) return null;
    set({ isLoading: true });
    try {
      const res = await fetch('/api/knowledge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, organizationId: user.organizationId }),
      });
      const data = await res.json();
      set({ isLoading: false });
      if (res.ok) {
        await get().fetchRules();
        await get().fetchTemplates();
        await get().fetchAuditLogs();
        await get().fetchDashboard();
        return data;
      } else {
        set({ error: data.error });
        return null;
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return null;
    }
  },
}));
