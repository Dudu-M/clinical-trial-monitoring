import { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
import { loadFromStorage, saveToStorage, generateId } from '../utils/storage';
import { parseExcel } from '../logic/parseExcel';
import { scoreSites } from '../logic/scoreSites';

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
      const trial = {
        ...action.trial,
        id: action.trial.id || generateId(),
        createdAt: new Date().toISOString(),
        sites: {},
        dataQualityNotices: [],
        lastUpdated: null,
      };
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
      const mergedSites = { ...existing.sites };
      for (const [siteId, newSite] of Object.entries(action.sites)) {
        const prev = mergedSites[siteId] || {};
        mergedSites[siteId] = {
          ...newSite,
          // Preserve user-added notes (objects) but keep Excel string notes in the new parse
          notes: newSite.notes || prev.notes || [],
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
          [action.trialId]: {
            ...trial,
            sites: { ...trial.sites, [action.siteId]: { ...site, notes: [...(site.notes || []), note] } },
          },
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
          [action.trialId]: {
            ...trial,
            sites: { ...trial.sites, [action.siteId]: { ...site, emailLog: [...(site.emailLog || []), entry] } },
          },
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

async function autoLoadExcel(dispatch) {
  try {
    const res = await fetch('/site_data_For_candidate.xlsx');
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    const { sites, notices, trialMeta } = parseExcel(buf);

    // Score sites
    const scored = scoreSites(sites, trialMeta);
    const sitesObj = {};
    for (const site of scored) sitesObj[site.id] = site;

    const trialId = generateId();
    dispatch({
      type: 'CREATE_TRIAL',
      trial: {
        id: trialId,
        name: trialMeta.trialName,
        sponsor: trialMeta.sponsor,
        indication: trialMeta.indication || '',
        totalTarget: trialMeta.totalTarget,
        requiredRunRate: trialMeta.requiredRunRate,
        monthsRemainingFromSheet: trialMeta.monthsRemainingFromSheet,
        startDate: trialMeta.trialStartDate ? trialMeta.trialStartDate.toISOString().split('T')[0] : '',
        targetCompletionDate: trialMeta.targetCompletionDate ? trialMeta.targetCompletionDate.toISOString().split('T')[0] : '',
      },
    });
    dispatch({ type: 'SAVE_UPLOAD', trialId, sites: sitesObj, notices });
  } catch (e) {
    console.warn('Auto-load failed:', e);
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Load from localStorage, then auto-load Excel if empty
  useEffect(() => {
    const saved = loadFromStorage();
    if (saved && Object.keys(saved.trials || {}).length > 0) {
      dispatch({ type: 'LOAD_STATE', payload: saved });
      setBootstrapped(true);
    } else {
      autoLoadExcel(dispatch).finally(() => setBootstrapped(true));
    }
  }, []);

  // Auto-save to localStorage after every state change
  useEffect(() => {
    if (bootstrapped) saveToStorage(state);
  }, [state, bootstrapped]);

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

  return (
    <AppContext.Provider value={{ state, dispatch, actions: actions(), bootstrapped }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
