import { Zap, Clock, Calendar } from 'lucide-react';

export const EVENT_TYPES = [
  { id: 'template_added',             label: 'Template Added',               category: 'Templates',         description: 'A new relay model template is added to the library' },
  { id: 'template_updated',           label: 'Template Updated',             category: 'Templates',         description: 'An existing relay model template is updated' },
  { id: 'template_deprecated',        label: 'Template Deprecated',          category: 'Templates',         description: 'A relay model template is marked as deprecated' },
  { id: 'new_feedback',               label: 'New Feedback Submitted',       category: 'Feedback',          description: 'A user submits new feedback on a template' },
  { id: 'feedback_resolved',          label: 'Feedback Resolved',            category: 'Feedback',          description: 'A feedback item is resolved or closed' },
  { id: 'new_driver_bug',             label: 'New Driver Bug',               category: 'Driver Bugs',       description: 'A new driver bug is reported' },
  { id: 'driver_bug_status_changed',  label: 'Driver Bug Status Changed',    category: 'Driver Bugs',       description: 'A driver bug changes status' },
  { id: 'new_template_request',       label: 'New Template Request',         category: 'Template Requests', description: 'A new RTMS template request is submitted' },
  { id: 'template_request_approved',  label: 'Template Request Approved',    category: 'Template Requests', description: 'A template request is approved by admin' },
  { id: 'executive_report_generated', label: 'Executive Report Generated',   category: 'Reports',           description: 'An executive PDF report is generated' },
  { id: 'weekly_executive_summary',   label: 'Weekly Executive Summary',     category: 'Reports',           description: 'Weekly digest with templates, issues, requests, and ratings activity' },
];

export const FREQUENCIES = [
  { id: 'immediate', label: 'Immediate',     icon: Zap,      description: 'Sent as soon as the event occurs' },
  { id: 'daily',     label: 'Daily Digest',  icon: Clock,    description: 'Batched into a once-daily email' },
  { id: 'weekly',    label: 'Weekly Digest', icon: Calendar, description: 'Batched into a weekly summary email' },
];
