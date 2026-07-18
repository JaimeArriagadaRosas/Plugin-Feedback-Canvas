import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../../../components/atoms/Input';
import Select from '../../../components/atoms/Select';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './TemplateForm.module.css';

export default function TemplateForm({ name, range, onSave }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name, range }
  });
  const logSave = useButtonLogger();

  const onSubmit = useCallback(
    async (data) => {
      await logSave('TEMPLATE_FORM_SAVE', () => onSave?.(data))();
    },
    [onSave, logSave]
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.field}>
        <label className={styles.label}>Nombre de la Plantilla</label>
        <Input
          {...register('name', { required: 'El nombre es obligatorio' })}
          placeholder="Ej: Feedback de Refuerzo Semanal"
        />
        {errors.name && <span className={styles.error}>{errors.name.message}</span>}
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Rango de Calificación Asociado</label>
        <Select
          {...register('range', { required: 'El rango es obligatorio' })}
          options={[
            { value: 'Rango Bajo: 0-3.9', label: 'Rango Bajo: 0-3.9' },
            { value: 'Rango Medio: 4.0-5.9', label: 'Rango Medio: 4.0-5.9' },
            { value: 'Rango Logrado: 6-10', label: 'Rango Logrado: 6-10' },
          ]}
        />
        {errors.range && <span className={styles.error}>{errors.range.message}</span>}
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.saveButton}>Guardar Plantilla</button>
      </div>
    </form>
  );
}
