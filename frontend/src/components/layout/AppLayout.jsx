import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

const NAV = {
  admin: [
    { to: '/dashboard',     label: 'Dashboard'      },
    { to: '/users',         label: 'User management'},
    { to: '/students',      label: 'Students'       },
    { to: '/teachers',      label: 'Teachers'       },
    { to: '/classes',       label: 'Classes'        },
    { to: '/attendance',    label: 'Attendance'     },
    { to: '/grades',        label: 'Grades'         },
    { to: '/reports',       label: 'Reports'        },
    { to: '/analytics',     label: 'Analytics'      },
    { to: '/messages',      label: 'Messages'       },
    { to: '/announcements', label: 'Announcements'  },
    { to: '/settings',      label: 'Settings'       },
  ],
  teacher: [
    { to: '/dashboard',     label: 'Dashboard'     },
    { to: '/attendance',    label: 'Attendance'    },
    { to: '/grades',        label: 'Grades'        },
    { to: '/reports',       label: 'Reports'       },
    { to: '/messages',      label: 'Messages'      },
    { to: '/announcements', label: 'Announcements' },
    { to: '/settings',      label: 'Settings'      },
  ],
  accountant: [
    { to: '/fees',              label: 'Dashboard'       },
    { to: '/fees/payments/new', label: 'Record payment'  },
    { to: '/fees/payments',     label: 'Payment history' },
    { to: '/fees/defaulters',   label: 'Defaulters'      },
    { to: '/fees/cleared',      label: 'Cleared'         },
    { to: '/fees/structures',   label: 'Fee structures'  },
    { to: '/messages',          label: 'Messages'        },
    { to: '/announcements',     label: 'Announcements'   },
    { to: '/settings',          label: 'Settings'        },
  ],
  parent: [
    { to: '/dashboard',     label: 'Dashboard'     },
    { to: '/my-child',      label: 'My child'      },
    { to: '/reports',       label: 'Reports'       },
    { to: '/messages',      label: 'Messages'      },
    { to: '/announcements', label: 'Announcements' },
    { to: '/settings',      label: 'Settings'      },
  ],
  student: [
    { to: '/dashboard',     label: 'Home'          },
    { to: '/grades',        label: 'My grades'     },
    { to: '/reports',       label: 'Reports'       },
    { to: '/messages',      label: 'Messages'      },
    { to: '/announcements', label: 'Announcements' },
    { to: '/settings',      label: 'Settings'      },
  ],
};

const ROLE_COLOR = {
  admin:      'bg-blue-100 text-blue-700',
  teacher:    'bg-teal-100 text-teal-700',
  parent:     'bg-pink-100 text-pink-700',
  student:    'bg-purple-100 text-purple-700',
  accountant: 'bg-amber-100 text-amber-700',
};

export default function AppLayout() {
  const user     = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const links    = NAV[user?.role] || [];

  async function handleLogout() {
    await dispatch(logout());
    toast.success('Logged out');
    navigate('/login');
  }

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-52 flex-shrink-0 flex flex-col bg-white border-r border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
          <img src="/logo.png" alt="EduClass" className="w-8 h-8 object-contain" />
          <span className="text-sm font-semibold text-gray-800">EduClass</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {links.map(link => (
            <NavLink key={link.to} to={link.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors
                 ${isActive
                   ? 'bg-blue-50 text-blue-700 font-medium'
                   : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`
              }>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${ROLE_COLOR[user?.role]}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
            <button onClick={handleLogout} title="Logout"
              className="p-1 rounded hover:bg-gray-200 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-screen-xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}