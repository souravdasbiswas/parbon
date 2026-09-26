const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE_RE = /^[+()\d\s-]{6,20}$/;

const clean = (value) =>
  typeof value === 'string'
    ? value
        .normalize('NFC')
        // strip control characters except newline / tab
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
    : '';

/**
 * Validates and normalises an enquiry payload.
 * Returns { value } on success or { errors } — a map of field -> message.
 */
export function validateInquiry(body, allowedTypes) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};

  const value = {
    type: clean(input.type) || 'general',
    name: clean(input.name),
    email: clean(input.email).toLowerCase(),
    phone: clean(input.phone),
    message: clean(input.message),
  };

  if (!allowedTypes.includes(value.type)) errors.type = 'Please choose a valid enquiry type.';
  if (value.name.length < 2) errors.name = 'Please tell us your name.';
  else if (value.name.length > 100) errors.name = 'Name must be 100 characters or fewer.';
  if (!EMAIL_RE.test(value.email) || value.email.length > 200) errors.email = 'Please enter a valid email address.';
  if (value.phone && !PHONE_RE.test(value.phone)) errors.phone = 'Please enter a valid phone number.';
  if (value.message.length < 10) errors.message = 'Please write a message of at least 10 characters.';
  else if (value.message.length > 3000) errors.message = 'Message must be 3000 characters or fewer.';

  if (!value.phone) delete value.phone;

  return Object.keys(errors).length ? { errors } : { value };
}
