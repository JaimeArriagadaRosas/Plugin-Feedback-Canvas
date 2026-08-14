import React from 'react';
import styles from './QuizViewer.module.css';

export default function QuizViewer({ quizDetails, studentName }) {
  if (!quizDetails || !quizDetails.questions || quizDetails.questions.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.fallbackCard}>
          <p>No questions found for this quiz or the format is not supported.</p>
        </div>
      </div>
    );
  }

  const { questions, latestAttempt } = quizDetails;
  
  // Extraer las respuestas del último intento
  const submissionData = latestAttempt?.submission_data || [];
  
  // Mapa para búsqueda rápida de respuestas
  const answersMap = new Map();
  submissionData.forEach(ans => {
    answersMap.set(String(ans.question_id), ans);
  });

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3>Quiz by {studentName}</h3>
        <p className={styles.scoreInfo}>
          Score: {latestAttempt?.score ?? 'N/A'} 
          {latestAttempt?.score_before_regrade ? ` (Before: ${latestAttempt.score_before_regrade})` : ''}
        </p>
      </div>

      <div className={styles.questionsContainer}>
        {questions.map((q, idx) => {
          const studentAns = answersMap.get(String(q.id));
          const isCorrect = studentAns?.correct === true || studentAns?.correct === 'true';
          const isIncorrect = studentAns?.correct === false || studentAns?.correct === 'false';
          const isPartial = studentAns?.correct === 'partial';

          let statusClass = styles.statusNeutral;
          if (isCorrect) statusClass = styles.statusCorrect;
          else if (isIncorrect) statusClass = styles.statusIncorrect;
          else if (isPartial) statusClass = styles.statusPartial;

          return (
            <div key={q.id} className={`${styles.questionCard} ${statusClass}`}>
              <div className={styles.questionHeader}>
                <span className={styles.questionTitle}>
                  {idx + 1}. {q.question_name || 'Question'}
                </span>
                <span className={styles.questionPoints}>
                  {studentAns?.points ?? 0} / {q.points_possible} pts
                </span>
              </div>
              
              <div 
                className={styles.questionText} 
                dangerouslySetInnerHTML={{ __html: q.question_text }} 
              />

              {q.answers && q.answers.length > 0 && (
                <div className={styles.answersList}>
                  {q.answers.map(ans => {
                    const isSelected = studentAns && String(studentAns.answer_id) === String(ans.id);
                    // Si es una pregunta de opción múltiple con respuestas múltiples, `answer_id` podría no aplicar así, pero cubrimos lo básico
                    return (
                      <div 
                        key={ans.id} 
                        className={`${styles.answerItem} ${isSelected ? styles.answerSelected : ''} ${ans.weight > 0 ? styles.answerCorrectHighlight : ''}`}
                      >
                        <span className={styles.answerMarker}>
                          {isSelected ? '■' : '□'}
                        </span>
                        <span 
                          className={styles.answerText} 
                          dangerouslySetInnerHTML={{ __html: ans.html || ans.text }} 
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
