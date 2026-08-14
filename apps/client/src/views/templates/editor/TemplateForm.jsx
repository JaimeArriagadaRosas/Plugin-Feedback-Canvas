import { useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Input from '../../../components/atoms/Input';
import styles from './TemplateForm.module.css';

export default function TemplateForm({ name, setName }) {
  const { register, watch } = useForm({
    defaultValues: { name }
  });

  const watchName = watch('name');

  useEffect(() => {
    if (watchName !== name && setName) {
      setName(watchName);
    }
  }, [watchName, setName, name]);

  return (
    <form className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Template Name</label>
        <Input
          {...register('name')}
          placeholder="Ex: Weekly Reinforcement Feedback"
        />
      </div>
    </form>
  );
}
