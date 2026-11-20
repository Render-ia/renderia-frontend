/**
 * Like form.reportValidity(), but a required text field filled only with
 * spaces also counts as empty (the browser alone accepts "   " as a value).
 */
export function reportFormValidity(form: HTMLFormElement): boolean {
  const fields = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[required]:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="password"]), textarea[required]',
  );
  fields.forEach((field) => {
    field.setCustomValidity(field.value.length > 0 && field.value.trim() === '' ? 'Este campo no puede quedar en blanco.' : '');
  });
  return form.reportValidity();
}
