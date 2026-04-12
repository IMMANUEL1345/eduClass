import React from 'react';

// ── Button ───────────────────────────────────────────────
export function Button({ children, variant = 'default', size = 'md', loading, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    default:  'bg-white border-gray-200 text-gray-800 hover:bg-gray-50',
    primary:  'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
    danger:   'bg-red-500 border-red-500 text-white hover:bg-red-600',
    ghost:    'border-transparent text-gray-600 hover:bg-gray-100',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner size="sm" className="mr-2" /> : null}
      {children}
    </button>
  );
}

// ── Input ────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-500">{label}</label>}
      <input
        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-800
                    border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500
                    placeholder:text-gray-400 ${error ? 'border-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// ── Select ───────────────────────────────────────────────
export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-gray-500">{label}</label>}
      <select
        className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-800
                    border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────
const BADGE_COLORS = {
  green:  'bg-green-100 text-green-800',
  blue:   'bg-blue-100 text-blue-800',
  amber:  'bg-amber-100 text-amber-800',
  red:    'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  gray:   'bg-gray-100 text-gray-700',
};

export function Badge({ children, color = 'gray' }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${BADGE_COLORS[color]}`}>
      {children}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────
export function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-sm font-medium text-gray-500">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = { blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600', red: 'text-red-500', purple: 'text-purple-600' };
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-medium ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────
export function Table({ columns, data, onRowClick, emptyText = 'No data' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th key={col.key} className="text-left py-2 px-3 text-xs font-medium text-gray-400"
                  style={col.width ? { width: col.width } : {}}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-sm text-gray-400">{emptyText}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id ?? i}
                className={`border-b border-gray-50 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                onClick={() => onRowClick?.(row)}>
              {columns.map((col) => (
                <td key={col.key} className="py-2.5 px-3 text-gray-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────
export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <svg className={`animate-spin text-blue-500 ${sizes[size]} ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  );
}

// ── Page header ──────────────────────────────────────────
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-medium text-gray-800">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────
export function Empty({ message = 'Nothing here yet' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
        </svg>
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
