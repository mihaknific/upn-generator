/**
 * Storage Utility for persisting UPN form data in localStorage.
 */
export const Storage = {
    KEY: 'upn_studio_2026_data',
    PRIVATE_KEY: 'upn_studio_private_mode',
    SAVE_DELAY: 500,
    _saveTimer: null,
    _pendingData: null,

    /**
     * Checks if private mode (no saving to localStorage) is active.
     * @returns {boolean}
     */
    isPrivate() {
        return sessionStorage.getItem(this.PRIVATE_KEY) === 'true';
    },

    /**
     * Sets private mode status.
     * @param {boolean} val
     */
    setPrivate(val) {
        if (val) {
            sessionStorage.setItem(this.PRIVATE_KEY, 'true');
            this.clear();
        } else {
            sessionStorage.removeItem(this.PRIVATE_KEY);
        }
    },

    /**
     * Clears stored form data from localStorage.
     */
    clear() {
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this._pendingData = null;
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.mode) {
                    localStorage.setItem(this.KEY, JSON.stringify({ mode: parsed.mode }));
                    return;
                }
            }
            localStorage.removeItem(this.KEY);
        } catch {
            localStorage.removeItem(this.KEY);
        }
    },

    /**
     * Schedules a save after the user pauses editing.
     * @param {Object} data
     */
    scheduleSave(data) {
        if (this.isPrivate()) return;
        this._pendingData = { ...data };
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.flush(), this.SAVE_DELAY);
    },

    /**
     * Writes any pending changes immediately.
     */
    flush() {
        if (this.isPrivate() || !this._pendingData) return;
        const data = this._pendingData;
        this._pendingData = null;
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this.save(data);
    },

    /**
     * Saves the current store state to localStorage.
     * @param {Object} data 
     */
    save(data) {
        clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this._pendingData = null;
        if (this.isPrivate()) return;
        try {
            // Exclude dates from being saved to ensure fresh defaults on reload
            const { paymentDate, dueDate, ...toSave } = data;
            const raw = JSON.stringify(toSave);
            localStorage.setItem(this.KEY, raw);
        } catch (e) {
            console.error('UPN Storage: Failed to save data.', e);
        }
    },

    /**
     * Loads the saved state from localStorage.
     * @returns {Object|null}
     */
    load() {
        if (this.isPrivate()) return null;
        try {
            const raw = localStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('UPN Storage: Failed to load data.', e);
            return null;
        }
    }
};
