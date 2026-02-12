type Permission = string;

export function getDefaultPermissions(role: string): Permission[] {
  switch (role) {
    case 'outlet_admin':
      return [
        'view_dashboard',
        'manage_invoices',
        'manage_expenses',
        'view_reports',
        'manage_vendors',
        'approve_invoices',
        'view_analytics',
        'manage_staff',
        'view_audit_trail',
      ] as Permission[];
    case 'staff':
      return [
        'view_dashboard',
        'create_invoices',
        'create_expenses',
        'view_reports',
      ] as Permission[];
    case 'business_owner':
      return [
        'view_dashboard',
        'manage_invoices',
        'manage_expenses',
        'view_reports',
        'manage_vendors',
        'approve_invoices',
        'view_analytics',
        'manage_staff',
        'view_audit_trail',
        'view_all_outlets',
        'create_global_vendors',
        'approve_vendor_invoices',
        'view_consolidated_reports',
      ] as Permission[];
    case 'super_admin':
      return [
        'view_dashboard',
        'manage_invoices',
        'manage_expenses',
        'view_reports',
        'manage_vendors',
        'approve_invoices',
        'view_analytics',
        'manage_staff',
        'view_audit_trail',
        'view_all_outlets',
        'create_global_vendors',
        'approve_vendor_invoices',
        'view_consolidated_reports',
        'manage_system',
      ] as Permission[];
    default:
      return [];
  }
}

export function getDefaultOpeningHours(businessType: string) {
  const defaultHours = {
    monday: { open: '09:00', close: '17:00', closed: false },
    tuesday: { open: '09:00', close: '17:00', closed: false },
    wednesday: { open: '09:00', close: '17:00', closed: false },
    thursday: { open: '09:00', close: '17:00', closed: false },
    friday: { open: '09:00', close: '17:00', closed: false },
    saturday: { open: '10:00', close: '16:00', closed: false },
    sunday: { open: '10:00', close: '16:00', closed: true },
  };

  switch (businessType) {
    case 'restaurant':
      return {
        monday: { open: '11:00', close: '22:00', closed: false },
        tuesday: { open: '11:00', close: '22:00', closed: false },
        wednesday: { open: '11:00', close: '22:00', closed: false },
        thursday: { open: '11:00', close: '22:00', closed: false },
        friday: { open: '11:00', close: '23:00', closed: false },
        saturday: { open: '11:00', close: '23:00', closed: false },
        sunday: { open: '11:00', close: '21:00', closed: false },
      };
    case 'lounge':
      return {
        monday: { open: '17:00', close: '02:00', closed: true },
        tuesday: { open: '17:00', close: '02:00', closed: true },
        wednesday: { open: '17:00', close: '02:00', closed: false },
        thursday: { open: '17:00', close: '02:00', closed: false },
        friday: { open: '17:00', close: '03:00', closed: false },
        saturday: { open: '17:00', close: '03:00', closed: false },
        sunday: { open: '17:00', close: '02:00', closed: false },
      };
    case 'cafe':
      return {
        monday: { open: '07:00', close: '19:00', closed: false },
        tuesday: { open: '07:00', close: '19:00', closed: false },
        wednesday: { open: '07:00', close: '19:00', closed: false },
        thursday: { open: '07:00', close: '19:00', closed: false },
        friday: { open: '07:00', close: '20:00', closed: false },
        saturday: { open: '08:00', close: '20:00', closed: false },
        sunday: { open: '08:00', close: '18:00', closed: false },
      };
    case 'supermarket':
      return {
        monday: { open: '06:00', close: '22:00', closed: false },
        tuesday: { open: '06:00', close: '22:00', closed: false },
        wednesday: { open: '06:00', close: '22:00', closed: false },
        thursday: { open: '06:00', close: '22:00', closed: false },
        friday: { open: '06:00', close: '22:00', closed: false },
        saturday: { open: '06:00', close: '22:00', closed: false },
        sunday: { open: '08:00', close: '20:00', closed: false },
      };
    default:
      return defaultHours;
  }
}
