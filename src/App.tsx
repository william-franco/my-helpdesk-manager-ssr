import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type TicketStatus = 'open' | 'in-progress' | 'waiting' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
type TicketCategory = 'technical' | 'billing' | 'account' | 'feature' | 'bug' | 'other';

interface Comment {
  id: string;
  ticketId: string;
  author: string;
  content: string;
  isInternal: boolean;
  timestamp: number;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  author: string;
  assignedTo?: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  comments: Comment[];
}

interface TicketsData {
  tickets: Ticket[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const isClient = typeof window !== 'undefined';

const CATEGORIES: { value: TicketCategory; label: string; icon: string; color: string }[] = [
  { value: 'technical', label: 'Técnico', icon: '🔧', color: '#3b82f6' },
  { value: 'billing', label: 'Cobrança', icon: '💳', color: '#10b981' },
  { value: 'account', label: 'Conta', icon: '👤', color: '#8b5cf6' },
  { value: 'feature', label: 'Recurso', icon: '✨', color: '#06b6d4' },
  { value: 'bug', label: 'Bug', icon: '🐛', color: '#ef4444' },
  { value: 'other', label: 'Outro', icon: '📦', color: '#64748b' },
];

const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: '#64748b' },
  { value: 'medium', label: 'Média', color: '#3b82f6' },
  { value: 'high', label: 'Alta', color: '#f59e0b' },
  { value: 'urgent', label: 'Urgente', color: '#ef4444' },
];

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: string }> = {
  open: { label: 'Aberto', color: '#3b82f6', icon: '🆕' },
  'in-progress': { label: 'Em Andamento', color: '#f59e0b', icon: '⚙️' },
  waiting: { label: 'Aguardando', color: '#8b5cf6', icon: '⏳' },
  resolved: { label: 'Resolvido', color: '#10b981', icon: '✅' },
  closed: { label: 'Fechado', color: '#64748b', icon: '🔒' },
};

const DEFAULT_TICKETS: Ticket[] = [
  {
    id: 'ticket_1',
    title: 'Erro ao fazer login',
    description: 'Não consigo fazer login na plataforma. Aparece mensagem de erro "credenciais inválidas" mesmo com senha correta.',
    category: 'technical',
    priority: 'high',
    status: 'in-progress',
    author: 'João Silva',
    assignedTo: 'Suporte Técnico',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    updatedAt: Date.now() - 30 * 60 * 1000,
    comments: [
      {
        id: 'comment_1',
        ticketId: 'ticket_1',
        author: 'Suporte Técnico',
        content: 'Olá João, estamos investigando o problema. Pode verificar se seu navegador está atualizado?',
        isInternal: false,
        timestamp: Date.now() - 30 * 60 * 1000,
      },
    ],
  },
  {
    id: 'ticket_2',
    title: 'Cobrança duplicada',
    description: 'Fui cobrado duas vezes este mês. Preciso de reembolso.',
    category: 'billing',
    priority: 'urgent',
    status: 'open',
    author: 'Maria Santos',
    createdAt: Date.now() - 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 24 * 60 * 60 * 1000,
    comments: [],
  },
  {
    id: 'ticket_3',
    title: 'Sugestão de nova funcionalidade',
    description: 'Seria ótimo ter um modo escuro na plataforma.',
    category: 'feature',
    priority: 'low',
    status: 'resolved',
    author: 'Pedro Costa',
    assignedTo: 'Equipe de Produto',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    resolvedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    comments: [
      {
        id: 'comment_2',
        ticketId: 'ticket_3',
        author: 'Equipe de Produto',
        content: 'Ótima sugestão! Já adicionamos ao roadmap do próximo trimestre.',
        isInternal: false,
        timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000,
      },
    ],
  },
];

// ============================================================================
// STORAGE SERVICE
// ============================================================================

class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'tickets_darkMode',
    TICKETS_DATA: 'tickets_data',
  });

  static saveToStorage(key: string, value: any): void {
    if (!isClient) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  }

  static loadFromStorage<T>(key: string, defaultValue: T): T {
    if (!isClient) return defaultValue;
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
      return defaultValue;
    }
  }

  static clearStorage(): void {
    if (!isClient) return;
    try {
      sessionStorage.removeItem(this.STORAGE_KEYS.DARK_MODE);
      sessionStorage.removeItem(this.STORAGE_KEYS.TICKETS_DATA);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  static getKeys() {
    return this.STORAGE_KEYS;
  }
}

// ============================================================================
// MODEL LAYER
// ============================================================================

class TicketsModel {
  private tickets: Ticket[];

  constructor(initialData?: TicketsData) {
    this.tickets = initialData?.tickets || [...DEFAULT_TICKETS];
  }

  getAllTickets(): Ticket[] {
    return [...this.tickets].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getTicketById(id: string): Ticket | null {
    return this.tickets.find(t => t.id === id) || null;
  }

  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'comments'>): Ticket {
    const newTicket: Ticket = {
      ...ticket,
      id: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      comments: [],
    };
    this.tickets.push(newTicket);
    return newTicket;
  }

  updateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
    const index = this.tickets.findIndex(t => t.id === id);
    if (index === -1) return null;

    this.tickets[index] = {
      ...this.tickets[index],
      ...updates,
      updatedAt: Date.now(),
    };

    if (updates.status === 'resolved' && !this.tickets[index].resolvedAt) {
      this.tickets[index].resolvedAt = Date.now();
    }

    return this.tickets[index];
  }

  deleteTicket(id: string): boolean {
    const initialLength = this.tickets.length;
    this.tickets = this.tickets.filter(t => t.id !== id);
    return this.tickets.length < initialLength;
  }

  searchTickets(term: string): Ticket[] {
    const lowerTerm = term.toLowerCase();
    return this.tickets.filter(t =>
      t.title.toLowerCase().includes(lowerTerm) ||
      t.description.toLowerCase().includes(lowerTerm) ||
      t.id.toLowerCase().includes(lowerTerm)
    );
  }

  filterByCategory(category: TicketCategory): Ticket[] {
    return this.tickets.filter(t => t.category === category);
  }

  filterByPriority(priority: TicketPriority): Ticket[] {
    return this.tickets.filter(t => t.priority === priority);
  }

  filterByStatus(status: TicketStatus): Ticket[] {
    return this.tickets.filter(t => t.status === status);
  }

  addComment(ticketId: string, comment: Omit<Comment, 'id' | 'ticketId' | 'timestamp'>): Comment | null {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return null;

    const newComment: Comment = {
      ...comment,
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ticketId,
      timestamp: Date.now(),
    };

    ticket.comments.push(newComment);
    ticket.updatedAt = Date.now();

    return newComment;
  }

  getTicketComments(ticketId: string): Comment[] {
    const ticket = this.getTicketById(ticketId);
    return ticket ? [...ticket.comments].sort((a, b) => a.timestamp - b.timestamp) : [];
  }

  getStatistics(): {
    total: number;
    open: number;
    inProgress: number;
    waiting: number;
    resolved: number;
    closed: number;
    byPriority: Record<TicketPriority, number>;
    byCategory: Record<TicketCategory, number>;
    averageResolutionTime: number;
  } {
    const total = this.tickets.length;
    const open = this.tickets.filter(t => t.status === 'open').length;
    const inProgress = this.tickets.filter(t => t.status === 'in-progress').length;
    const waiting = this.tickets.filter(t => t.status === 'waiting').length;
    const resolved = this.tickets.filter(t => t.status === 'resolved').length;
    const closed = this.tickets.filter(t => t.status === 'closed').length;

    const byPriority: Record<TicketPriority, number> = {
      low: this.tickets.filter(t => t.priority === 'low').length,
      medium: this.tickets.filter(t => t.priority === 'medium').length,
      high: this.tickets.filter(t => t.priority === 'high').length,
      urgent: this.tickets.filter(t => t.priority === 'urgent').length,
    };

    const byCategory: Record<TicketCategory, number> = {
      technical: this.tickets.filter(t => t.category === 'technical').length,
      billing: this.tickets.filter(t => t.category === 'billing').length,
      account: this.tickets.filter(t => t.category === 'account').length,
      feature: this.tickets.filter(t => t.category === 'feature').length,
      bug: this.tickets.filter(t => t.category === 'bug').length,
      other: this.tickets.filter(t => t.category === 'other').length,
    };

    const resolvedTickets = this.tickets.filter(t => t.resolvedAt);
    const averageResolutionTime = resolvedTickets.length > 0
      ? resolvedTickets.reduce((sum, t) => sum + (t.resolvedAt! - t.createdAt), 0) / resolvedTickets.length
      : 0;

    return {
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      byPriority,
      byCategory,
      averageResolutionTime,
    };
  }

  getUrgentTickets(): Ticket[] {
    return this.tickets
      .filter(t => t.priority === 'urgent' && (t.status === 'open' || t.status === 'in-progress'))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  changeTicketStatus(ticketId: string, newStatus: TicketStatus): boolean {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) return false;

    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      open: ['in-progress', 'closed'],
      'in-progress': ['waiting', 'resolved', 'closed'],
      waiting: ['in-progress', 'closed'],
      resolved: ['closed', 'open'],
      closed: ['open'],
    };

    if (!validTransitions[ticket.status].includes(newStatus)) {
      return false;
    }

    this.updateTicket(ticketId, { status: newStatus });
    return true;
  }

  syncToStorage(): void {
    StorageService.saveToStorage(StorageService.getKeys().TICKETS_DATA, {
      tickets: this.tickets,
    });
  }

  static loadFromStorage(): TicketsModel {
    const data = StorageService.loadFromStorage<TicketsData | null>(
      StorageService.getKeys().TICKETS_DATA,
      null
    );
    return new TicketsModel(data || undefined);
  }
}

// ============================================================================
// CONTROLLER LAYER
// ============================================================================

class TicketsController {
  private model: TicketsModel;
  private listeners: Set<() => void>;

  constructor(model: TicketsModel) {
    this.model = model;
    this.listeners = new Set();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.model.syncToStorage();
    this.listeners.forEach(listener => listener());
  }

  getAllTickets = () => this.model.getAllTickets();
  getTicketById = (id: string) => this.model.getTicketById(id);
  searchTickets = (term: string) => this.model.searchTickets(term);
  filterByCategory = (category: TicketCategory) => this.model.filterByCategory(category);
  filterByPriority = (priority: TicketPriority) => this.model.filterByPriority(priority);
  filterByStatus = (status: TicketStatus) => this.model.filterByStatus(status);
  getUrgentTickets = () => this.model.getUrgentTickets();

  createTicket(ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'comments'>): void {
    this.model.createTicket(ticket);
    this.notify();
  }

  updateTicket(id: string, updates: Partial<Ticket>): void {
    this.model.updateTicket(id, updates);
    this.notify();
  }

  deleteTicket(id: string): void {
    this.model.deleteTicket(id);
    this.notify();
  }

  changeTicketStatus(ticketId: string, newStatus: TicketStatus): boolean {
    const success = this.model.changeTicketStatus(ticketId, newStatus);
    if (success) this.notify();
    return success;
  }

  addComment(ticketId: string, comment: Omit<Comment, 'id' | 'ticketId' | 'timestamp'>): void {
    this.model.addComment(ticketId, comment);
    this.notify();
  }

  getTicketComments = (ticketId: string) => this.model.getTicketComments(ticketId);
  getStatistics = () => this.model.getStatistics();
}

// ============================================================================
// CONTEXT
// ============================================================================

interface TicketsContextType {
  controller: TicketsController;
  forceUpdate: () => void;
}

const TicketsContext = createContext<TicketsContextType | null>(null);

const useTickets = () => {
  const context = useContext(TicketsContext);
  if (!context) throw new Error('useTickets must be used within TicketsProvider');
  return context;
};

// ============================================================================
// DEFAULT FORM DATA
// ============================================================================

const getDefaultFormData = () => ({
  title: '',
  description: '',
  category: 'technical' as TicketCategory,
  priority: 'medium' as TicketPriority,
  status: 'open' as TicketStatus,
  author: '',
  assignedTo: '',
});

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

const Header: React.FC<{
  darkMode: boolean;
  toggleTheme: () => void;
  onNavigate: (view: string) => void;
  currentView: string;
}> = ({ darkMode, toggleTheme, onNavigate, currentView }) => {
  const { controller } = useTickets();
  const urgentTickets = controller.getUrgentTickets();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand" onClick={() => onNavigate('dashboard')}>
          <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <h1>HelpDesk</h1>
        </div>

        <nav className="header-nav">
          <button
            onClick={() => onNavigate('dashboard')}
            className={currentView === 'dashboard' ? 'active' : ''}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('tickets')}
            className={currentView === 'tickets' ? 'active' : ''}
          >
            Tickets
          </button>
        </nav>

        <div className="header-actions">
          {urgentTickets.length > 0 && (
            <div className="urgent-badge">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="badge">{urgentTickets.length}</span>
            </div>
          )}
          <button onClick={toggleTheme} className="theme-toggle">
            {darkMode ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

const TicketCard: React.FC<{ ticket: Ticket; onClick: () => void }> = ({ ticket, onClick }) => {
  const category = CATEGORIES.find(c => c.value === ticket.category);
  const priority = PRIORITIES.find(p => p.value === ticket.priority);
  const status = STATUS_CONFIG[ticket.status];

  const timeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  return (
    <div className="ticket-card" onClick={onClick}>
      <div className="ticket-card-header">
        <div className="ticket-id">#{ticket.id.slice(-8)}</div>
        <div className="ticket-badges">
          <span className="badge-priority" style={{ backgroundColor: priority?.color }}>
            {priority?.label}
          </span>
          <span className="badge-status" style={{ backgroundColor: status.color }}>
            {status.icon} {status.label}
          </span>
        </div>
      </div>

      <h3 className="ticket-title">{ticket.title}</h3>
      <p className="ticket-description">{ticket.description}</p>

      <div className="ticket-footer">
        <div className="ticket-meta">
          <span className="ticket-category" style={{ color: category?.color }}>
            {category?.icon} {category?.label}
          </span>
          <span className="ticket-author">👤 {ticket.author}</span>
        </div>
        <div className="ticket-time">{timeAgo(ticket.updatedAt)}</div>
      </div>

      {ticket.comments.length > 0 && (
        <div className="ticket-comments-count">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {ticket.comments.length}
        </div>
      )}
    </div>
  );
};

const DashboardView: React.FC<{ onTicketClick: (id: string) => void }> = ({ onTicketClick }) => {
  const { controller } = useTickets();
  const stats = controller.getStatistics();
  const urgentTickets = controller.getUrgentTickets();
  const recentTickets = controller.getAllTickets().slice(0, 6);

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="dashboard-view">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">Visão geral do sistema de tickets</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total de Tickets</div>
          </div>
        </div>

        <div className="stat-card open">
          <div className="stat-icon">🆕</div>
          <div className="stat-content">
            <div className="stat-value">{stats.open}</div>
            <div className="stat-label">Abertos</div>
          </div>
        </div>

        <div className="stat-card progress">
          <div className="stat-icon">⚙️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.inProgress}</div>
            <div className="stat-label">Em Andamento</div>
          </div>
        </div>

        <div className="stat-card resolved">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.resolved}</div>
            <div className="stat-label">Resolvidos</div>
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stats-section">
          <h3>Por Prioridade</h3>
          <div className="priority-stats">
            {PRIORITIES.map(p => (
              <div key={p.value} className="priority-item">
                <span className="priority-label" style={{ color: p.color }}>
                  {p.label}
                </span>
                <span className="priority-count">{stats.byPriority[p.value]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="stats-section">
          <h3>Tempo Médio de Resolução</h3>
          <div className="resolution-time">
            {stats.averageResolutionTime > 0 ? formatTime(stats.averageResolutionTime) : 'N/A'}
          </div>
        </div>
      </div>

      {urgentTickets.length > 0 && (
        <div className="urgent-section">
          <h3>⚠️ Tickets Urgentes</h3>
          <div className="urgent-list">
            {urgentTickets.map(ticket => (
              <div
                key={ticket.id}
                className="urgent-item"
                onClick={() => onTicketClick(ticket.id)}
              >
                <div className="urgent-info">
                  <h4>{ticket.title}</h4>
                  <span className="urgent-author">Por {ticket.author}</span>
                </div>
                <span className="urgent-category">{CATEGORIES.find(c => c.value === ticket.category)?.icon}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recent-tickets">
        <h3>Tickets Recentes</h3>
        <div className="tickets-grid">
          {recentTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket.id)} />
          ))}
        </div>
      </div>
    </div>
  );
};

const TicketsListView: React.FC<{
  onTicketClick: (id: string) => void;
  onNewTicket: () => void;
}> = ({ onTicketClick, onNewTicket }) => {
  const { controller } = useTickets();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [controller]);

  const allTickets = controller.getAllTickets();

  const filteredTickets = useMemo(() => {
    let tickets = [...allTickets];

    if (searchTerm) {
      const searchResults = controller.searchTickets(searchTerm);
      tickets = tickets.filter(t => searchResults.some(sr => sr.id === t.id));
    }

    if (selectedCategory) {
      tickets = tickets.filter(t => t.category === selectedCategory);
    }

    if (selectedPriority) {
      tickets = tickets.filter(t => t.priority === selectedPriority);
    }

    if (selectedStatus) {
      tickets = tickets.filter(t => t.status === selectedStatus);
    }

    return tickets;
  }, [allTickets, searchTerm, selectedCategory, selectedPriority, selectedStatus, renderKey]);

  return (
    <div className="tickets-list-view">
      <div className="list-header">
        <h2>Todos os Tickets</h2>
        <button onClick={onNewTicket} className="btn-primary">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Ticket
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar tickets..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-groups">
          <div className="filter-group">
            <span className="filter-label">Categoria:</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
            >
              Todas
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`filter-btn ${selectedCategory === cat.value ? 'active' : ''}`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-label">Prioridade:</span>
            <button
              onClick={() => setSelectedPriority(null)}
              className={`filter-btn ${!selectedPriority ? 'active' : ''}`}
            >
              Todas
            </button>
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                onClick={() => setSelectedPriority(p.value)}
                className={`filter-btn ${selectedPriority === p.value ? 'active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <button
              onClick={() => setSelectedStatus(null)}
              className={`filter-btn ${!selectedStatus ? 'active' : ''}`}
            >
              Todos
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedStatus(key as TicketStatus)}
                className={`filter-btn ${selectedStatus === key ? 'active' : ''}`}
              >
                {config.icon} {config.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tickets-count">
        {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket encontrado' : 'tickets encontrados'}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum ticket encontrado</p>
          <button onClick={onNewTicket} className="btn-primary">Criar Primeiro Ticket</button>
        </div>
      ) : (
        <div className="tickets-grid">
          {filteredTickets.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} onClick={() => onTicketClick(ticket.id)} />
          ))}
        </div>
      )}
    </div>
  );
};

const TicketDetailView: React.FC<{
  ticketId: string;
  onBack: () => void;
  onEdit: () => void;
}> = ({ ticketId, onBack, onEdit }) => {
  const { controller } = useTickets();
  const ticket = controller.getTicketById(ticketId);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('Suporte');

  if (!ticket) {
    return (
      <div className="ticket-detail-view">
        <div className="empty-state">
          <p>Ticket não encontrado</p>
          <button onClick={onBack} className="btn-primary">Voltar</button>
        </div>
      </div>
    );
  }

  const category = CATEGORIES.find(c => c.value === ticket.category);
  const priority = PRIORITIES.find(p => p.value === ticket.priority);
  const status = STATUS_CONFIG[ticket.status];

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    controller.addComment(ticketId, {
      author: commentAuthor,
      content: newComment.trim(),
      isInternal: false,
    });
    setNewComment('');
  };

  const handleStatusChange = (newStatus: TicketStatus) => {
    const success = controller.changeTicketStatus(ticketId, newStatus);
    if (!success) {
      alert('Não é possível mudar para este status diretamente');
    }
  };

  const handleDelete = () => {
    if (confirm('Deseja realmente excluir este ticket?')) {
      controller.deleteTicket(ticketId);
      onBack();
    }
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR');
  };

  return (
    <div className="ticket-detail-view">
      <div className="detail-header">
        <button onClick={onBack} className="btn-back">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar
        </button>
        <div className="detail-actions">
          <button onClick={onEdit} className="btn-secondary">Editar</button>
          <button onClick={handleDelete} className="btn-danger">Excluir</button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-hero">
          <div className="hero-header">
            <div className="hero-title">
              <h1>{ticket.title}</h1>
              <span className="ticket-id-detail">#{ticket.id.slice(-8)}</span>
            </div>
            <div className="hero-badges">
              <span className="badge-lg" style={{ backgroundColor: category?.color }}>
                {category?.icon} {category?.label}
              </span>
              <span className="badge-lg" style={{ backgroundColor: priority?.color }}>
                {priority?.label}
              </span>
            </div>
          </div>

          <p className="ticket-description-detail">{ticket.description}</p>

          <div className="ticket-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Autor:</span>
              <span className="meta-value">{ticket.author}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Criado em:</span>
              <span className="meta-value">{formatDateTime(ticket.createdAt)}</span>
            </div>
            {ticket.assignedTo && (
              <div className="meta-item">
                <span className="meta-label">Atribuído a:</span>
                <span className="meta-value">{ticket.assignedTo}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">Última atualização:</span>
              <span className="meta-value">{formatDateTime(ticket.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="status-workflow">
          <h3>Status do Ticket</h3>
          <div className="status-buttons">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleStatusChange(key as TicketStatus)}
                className={`status-btn ${ticket.status === key ? 'active' : ''}`}
                style={{
                  borderColor: config.color,
                  backgroundColor: ticket.status === key ? config.color : 'transparent',
                  color: ticket.status === key ? '#fff' : 'currentColor',
                }}
              >
                {config.icon} {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="comments-section">
          <h3>Histórico e Comentários ({ticket.comments.length})</h3>

          <div className="add-comment">
            <div className="comment-form">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={commentAuthor}
                  onChange={e => setCommentAuthor(e.target.value)}
                  className="comment-author-input"
                />
              </div>
              <textarea
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                rows={4}
              />
              <button onClick={handleAddComment} className="btn-primary">
                Enviar Comentário
              </button>
            </div>
          </div>

          <div className="comments-list">
            {ticket.comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <span className="comment-author">{comment.author}</span>
                  <span className="comment-time">{formatDateTime(comment.timestamp)}</span>
                </div>
                <p className="comment-content">{comment.content}</p>
              </div>
            ))}
            {ticket.comments.length === 0 && (
              <p className="empty-message">Nenhum comentário ainda</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TicketFormModal: React.FC<{
  isOpen: boolean;
  ticketId: string | null;
  onClose: () => void;
}> = ({ isOpen, ticketId, onClose }) => {
  const { controller } = useTickets();
  const existingTicket = ticketId ? controller.getTicketById(ticketId) : null;

  const [formData, setFormData] = useState<any>(getDefaultFormData());

  useEffect(() => {
    if (isOpen) {
      if (existingTicket) {
        setFormData(existingTicket);
      } else {
        setFormData(getDefaultFormData());
      }
    }
  }, [isOpen, ticketId, existingTicket]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (ticketId) {
      controller.updateTicket(ticketId, formData);
    } else {
      controller.createTicket(formData);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ticket-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{ticketId ? 'Editar Ticket' : 'Novo Ticket'}</h2>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="ticket-form">
          <div className="form-group">
            <label>Título *</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Descrição *</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Categoria</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Prioridade</label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Seu Nome *</label>
              <input
                type="text"
                value={formData.author}
                onChange={e => setFormData({ ...formData, author: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Atribuir a (opcional)</label>
              <input
                type="text"
                value={formData.assignedTo}
                onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
              />
            </div>
          </div>

          {ticketId && (
            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {ticketId ? 'Salvar' : 'Criar Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    return StorageService.loadFromStorage(StorageService.getKeys().DARK_MODE, false);
  });

  const [controller] = useState(() => {
    const model = TicketsModel.loadFromStorage();
    return new TicketsController(model);
  });

  const [, setUpdateCount] = useState(0);
  const forceUpdate = () => setUpdateCount(prev => prev + 1);

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = controller.subscribe(() => {
      forceUpdate();
    });
    return unsubscribe;
  }, [controller]);

  useEffect(() => {
    if (isClient) {
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, darkMode);
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const handleTicketClick = (id: string) => {
    setSelectedTicketId(id);
    setCurrentView('detail');
  };

  const handleNewTicket = () => {
    setEditingTicketId(null);
    setShowTicketForm(true);
  };

  const handleEditTicket = () => {
    setEditingTicketId(selectedTicketId);
    setShowTicketForm(true);
  };

  const handleBackFromDetail = () => {
    setSelectedTicketId(null);
    setCurrentView('tickets');
  };

  const handleCloseForm = () => {
    setShowTicketForm(false);
    setEditingTicketId(null);
  };

  return (
    <TicketsContext.Provider value={{ controller, forceUpdate }}>
      <div className="app">
        <Header
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          onNavigate={setCurrentView}
          currentView={currentView}
        />

        <main className="main-content">
          {currentView === 'dashboard' && <DashboardView onTicketClick={handleTicketClick} />}

          {currentView === 'tickets' && (
            <TicketsListView onTicketClick={handleTicketClick} onNewTicket={handleNewTicket} />
          )}

          {currentView === 'detail' && selectedTicketId && (
            <TicketDetailView
              ticketId={selectedTicketId}
              onBack={handleBackFromDetail}
              onEdit={handleEditTicket}
            />
          )}
        </main>

        <TicketFormModal
          isOpen={showTicketForm}
          ticketId={editingTicketId}
          onClose={handleCloseForm}
        />
      </div>
    </TicketsContext.Provider>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const APP_STYLES = `
:root {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #06b6d4;
  
  --bg: #f8fafc;
  --surface: #ffffff;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.1);
  --shadow-lg: rgba(0, 0, 0, 0.15);
  
  --header-bg: #ffffff;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --card-bg: #1e293b;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-lg: rgba(0, 0, 0, 0.5);
  
  --header-bg: #1e293b;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: var(--bg);
  color: var(--text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: var(--header-bg);
  box-shadow: var(--header-shadow);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
}

.header-nav {
  display: flex;
  gap: 0.5rem;
}

.header-nav button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-nav button:hover {
  background: var(--surface);
}

.header-nav button.active {
  background: var(--primary);
  color: white;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.urgent-badge {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--danger);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
}

.urgent-badge svg {
  width: 20px;
  height: 20px;
  color: white;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px var(--shadow);
}

.theme-toggle:hover {
  transform: scale(1.05);
  background: var(--primary);
  color: white;
}

.theme-toggle svg {
  width: 20px;
  height: 20px;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: white;
  color: var(--danger);
  border-radius: 10px;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}

.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.dashboard-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.dashboard-subtitle {
  color: var(--text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-lg);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-card.open .stat-value {
  color: var(--primary);
}

.stat-card.progress .stat-value {
  color: var(--warning);
}

.stat-card.resolved .stat-value {
  color: var(--success);
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.stats-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

.stats-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.priority-stats {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.priority-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: var(--surface);
  border-radius: 8px;
}

.priority-label {
  font-weight: 500;
}

.priority-count {
  font-weight: 700;
  font-size: 1.125rem;
}

.resolution-time {
  font-size: 3rem;
  font-weight: 700;
  color: var(--primary);
  text-align: center;
  padding: 2rem;
}

.urgent-section {
  background: var(--card-bg);
  border: 2px solid var(--danger);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.urgent-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--danger);
}

.urgent-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.urgent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: var(--surface);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.urgent-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px var(--shadow);
}

.urgent-info h4 {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.urgent-author {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.urgent-category {
  font-size: 1.5rem;
}

.recent-tickets h3,
.list-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.tickets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.ticket-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.ticket-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.ticket-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.ticket-id {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.ticket-badges {
  display: flex;
  gap: 0.5rem;
}

.badge-priority,
.badge-status {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.ticket-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.ticket-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ticket-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.ticket-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ticket-category,
.ticket-author {
  font-size: 0.875rem;
  font-weight: 500;
}

.ticket-author {
  color: var(--text-secondary);
}

.ticket-time {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.ticket-comments-count {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.ticket-comments-count svg {
  width: 16px;
  height: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.filters-section {
  margin-bottom: 1.5rem;
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-box svg {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}

.filter-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: var(--border);
}

.filter-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.tickets-count {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
}

.btn-back svg {
  width: 20px;
  height: 20px;
}

.detail-actions {
  display: flex;
  gap: 0.75rem;
}

.detail-hero {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.hero-header {
  margin-bottom: 1.5rem;
}

.hero-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.hero-title h1 {
  font-size: 1.75rem;
  font-weight: 700;
}

.ticket-id-detail {
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.hero-badges {
  display: flex;
  gap: 0.75rem;
}

.badge-lg {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 600;
  color: white;
}

.ticket-description-detail {
  font-size: 1rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  color: var(--text);
}

.ticket-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.meta-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.meta-value {
  font-size: 0.9375rem;
  font-weight: 500;
}

.status-workflow {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.status-workflow h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.status-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.status-btn {
  padding: 0.75rem 1.25rem;
  border: 2px solid;
  border-radius: 8px;
  background: transparent;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow);
}

.comments-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

.comments-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.add-comment {
  margin-bottom: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-author-input {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}

.comment-form textarea {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-family: inherit;
  resize: vertical;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-item {
  padding: 1rem;
  background: var(--surface);
  border-radius: 8px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.comment-author {
  font-weight: 600;
}

.comment-time {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.comment-content {
  line-height: 1.6;
}

.empty-message {
  text-align: center;
  color: var(--text-secondary);
  padding: 2rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.5rem;
}

.ticket-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-primary svg,
.btn-secondary svg {
  width: 18px;
  height: 18px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
    flex-wrap: wrap;
  }

  .header-nav {
    order: 3;
    width: 100%;
    justify-content: center;
  }

  .main-content {
    padding: 1rem;
  }

  .tickets-grid {
    grid-template-columns: 1fr;
  }

  .stats-row {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ticket-card {
  animation: fadeIn 0.3s ease-out;
}

::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 5px;
}
`;

if (isClient) {
  const styleId = 'app-styles';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = APP_STYLES;
    document.head.appendChild(styleElement);
  }
}

export default App;
