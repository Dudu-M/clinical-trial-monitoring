import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage, generateId } from '../utils/storage';

const AppContext = createContext(null);

const initialState = {
  trials: {},
  activeTrialId: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload;

    case 'CREATE_TRIAL': {
      const trial = { ...action.trial, id: action.trial.id || generateId(), createdAt: new Date().toISOString(), sites: {}, dataQualityNotices: [], lastUpdated: null };
      return { ...state, trials: { ...state.trials, [trial.id]: trial }, activeTrialId: trial.id };
    }

    case 'UPDATE_TRIAL': {
      const existing = state.trials[action.trialId];
      return { ...state, trials: { ...state.trials, [action.trialId]: { ...existing, ...action.updates } } };
    }

    case 'SET_ACTIVE_TRIAL':
      return { ...state, activeTrialId: action.trialId };

    case 'SAVE_UPLOAD': {
      const existing = state.trials[action.trialId];
      // Merge new sites with existing (preserve notes, emailLog)
      const mergedSites = { ...existing.sites };
      for (const [siteId, newSite] of Object.entries(action.sites)) {
        const prev = mergedSites[siteId] || {};
        mergedSites[siteId] = {
          ...newSite,
          notes: prev.notes || [],
          emailLog: prev.emailLog || [],
        };
      }
      return {
        ...state,
        trials: {
          ...state.trials,
          [action.trialId]: {
            ...existing,
            sites: mergedSites,
            dataQualityNotices: action.notices,
            lastUpdated: new Date().toISOString(),
          },
        },
      };
    }

    case 'ADD_NOTE': {
      const trial = state.trials[action.trialId];
      const site = trial.sites[action.siteId];
      const note = { id: generateId(), text: action.text, date: new Date().toISOString(), author: action.author || 'Trial Manager' };
      return {
        ...state,
        trials: {
          ...state.trials,
          [action.trialId]: { ...trial, sites: { ...trial.sites, [action.siteId]: { ...site, notes: [...(site.notes || []), note] } } },
        },
      };
    }

    case 'LOG_EMAIL': {
      const trial = state.trials[action.trialId];
      const site = trial.sites[action.siteId];
      const entry = { id: generateId(), sentDate: new Date().toISOString(), type: action.emailType, recipient: action.recipient, subject: action.subject };
      return {
        ...state,
        trials: {
          ...state.trials,
          [action.trialId]: { ...trial, sites: { ...trial.sites, [action.siteId]: { ...site, emailLog: [...(site.emailLog || []), entry] } } },
        },
      };
    }

    case 'DELETE_TRIAL': {
      const { [action.trialId]: _, ...remaining } = state.trials;
      const nextActive = state.activeTrialId === action.trialId ? null : state.activeTrialId;
      return { ...state, trials: remaining, activeTrialId: nextActive };
    }

    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) dispatch({ type: 'LOAD_STATE', payload: saved });
  }, []);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const actions = useCallback(() => ({
    loadState: (payload) => dispatch({ type: 'LOAD_STATE', payload }),
    createTrial: (trial) => dispatch({ type: 'CREATE_TRIAL', trial }),
    updateTrial: (trialId, updates) => dispatch({ type: 'UPDATE_TRIAL', trialId, updates }),
    setActiveTrial: (trialId) => dispatch({ type: 'SET_ACTIVE_TRIAL', trialId }),
    saveUpload: (trialId, sites, notices) => dispatch({ type: 'SAVE_UPLOAD', trialId, sites, notices }),
    addNote: (trialId, siteId, text) => dispatch({ type: 'ADD_NOTE', trialId, siteId, text }),
    logEmail: (trialId, siteId, emailType, recipient, subject) => dispatch({ type: 'LOG_EMAIL', trialId, siteId, emailType, recipient, subject }),
    deleteTrial: (trialId) => dispatch({ type: 'DELETE_TRIAL', trialId }),
  }), []);

  return <AppContext.Provider value={{ state, dispatch, actions: actions() }}>{children}</AppContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
