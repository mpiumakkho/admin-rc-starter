/*
 * ui: the building blocks user management is made of (cards, tables, forms, menus and more), as the Angular app's
 * user-management/ui. ui.scss, imported first in main.tsx, holds the theme variables and dark mode.
 */

export * from './core/types';
export * from './core/presence';
export * from './core/live-announcer';
export * from './core/media-query';
export * from './core/defer';
export * from './icon/icon';
export * from './theme/theme.service';
export * from './theme/accessible-view.service';
export * from './theme/scale.service';

// Actions and surfaces
export * from './button/button';
export * from './card/card';
export * from './dialog/dialog';
export * from './dialog/confirm';
export * from './menu/menu';
export * from './toast/toast';
export * from './page-header/page-header';
export * from './tooltip/tooltip';

// Data display
export * from './badge/badge';
export * from './avatar/avatar';
export * from './avatar/person';
export * from './icon-chip/icon-chip';
export * from './trend/trend';
export * from './stat-card/stat-card';
export * from './empty-state/empty-state';
export * from './alert/alert';
export * from './display/display';

// Navigation and filtering
export * from './segmented/segmented';
export * from './search-input/search-input';
export * from './filter-chips/filter-chips';
export * from './pagination/pagination';
export * from './person-select/person-select';

// Tables
export * from './table/table-state';
export * from './table/table';

// Forms
export * from './forms/form-field';
export * from './forms/checkbox';
export * from './forms/switch';
export * from './forms/choice-cards';
export * from './forms/file-dropzone';
