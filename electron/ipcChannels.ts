export const IPC = {
  DATA_LOAD:             'data:load',
  DATA_SAVE:             'data:save',
  DATA_CLEAR:            'data:clear',
  VIEW_STATE_LOAD:       'viewState:load',
  VIEW_STATE_SAVE:       'viewState:save',
  EXPORT_JSON:           'file:exportJson',
  IMPORT_JSON:           'file:importJson',
  APP_VERSION:           'app:version',
  WINDOW_CLOSING:        'window:closing',
  WINDOW_CLOSE_CONFIRMED:'window:closeConfirmed',
  PRINT:                 'window:print',
} as const;
