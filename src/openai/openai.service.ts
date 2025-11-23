import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { QuizQuestion, GenerateQuizParams } from './openai.interfaces';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);
  private readonly model: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
    }
    this.openai = new OpenAI({ apiKey });
    this.model = this.configService.get<string>('openai.model') || 'gpt-4o';
    this.logger.log(`Using OpenAI model: ${this.model}`);
  }

  async generateQuiz(params: GenerateQuizParams): Promise<QuizQuestion[]> {
    const { topic, difficulty, questionTypes, numberOfQuestions } = params;

    const prompt = this.buildPrompt(
      topic,
      difficulty,
      questionTypes,
      numberOfQuestions,
    );

    try {
      this.logger.log(
        `Generating quiz for topic: ${topic}, difficulty: ${difficulty}`,
      );

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert quiz creator. Generate educational quiz questions in valid JSON format only. Do not include any markdown formatting or code blocks. Ensure all options are unique and non-empty.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(content) as {
        questions?: unknown[];
      };
      const questions = parsedResponse.questions || [];

      // Validate and format questions
      return this.validateAndFormatQuestions(questions, questionTypes);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to generate quiz: ${errorMessage}`, errorStack);
      throw new InternalServerErrorException(
        'Failed to generate quiz. Please try again.',
      );
    }
  }

  private buildPrompt(
    topic: string,
    difficulty: string,
    questionTypes: string[],
    numberOfQuestions: number,
  ): string {
    const difficultyDescriptions = {
      easy: 'basic and straightforward',
      medium: 'moderately challenging',
      hard: 'advanced and complex',
    };

    const typeInstructions = questionTypes
      .map((type) => {
        switch (type) {
          case 'mcq':
            return 'Multiple Choice Questions (MCQ) with 4 options and only 1 correct answer';
          case 'true-false':
            return 'True/False questions with 2 options';
          case 'multiple-correct':
            return 'Multiple Choice Questions with 4 options where 2 or more answers can be correct';
          default:
            return type;
        }
      })
      .join(', ');

    return `Generate ${numberOfQuestions} ${difficultyDescriptions[difficulty]} quiz questions about "${topic}".

IMPORTANT: You MUST ONLY generate questions of these types: ${typeInstructions}
Do NOT generate questions of any other type. Each question must be one of: ${questionTypes.join(', ')}.

For each question, provide:
1. A clear question text
2. The appropriate number of options (4 for MCQ/multiple-correct, 2 for true-false)
3. ALL options MUST be unique - no duplicate options allowed
4. ALL options MUST have non-empty text
5. The correct answer(s) as an array of indices (0-based)
6. A brief explanation (2-3 sentences) of why the answer is correct

Return the response as a JSON object with this exact structure:
{
  "questions": [
    {
      "questionText": "What is...?",
      "questionType": "mcq" | "true-false" | "multiple-correct",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswers": [0],
      "explanation": "Explanation here..."
    }
  ]
}

Distribute question types evenly across the requested types (${questionTypes.join(', ')}). Make sure all questions are educational, accurate, and relevant to the topic. Remember: ALL options must be unique within each question and cannot be empty.`;
  }

  private validateAndFormatQuestions(
    questions: unknown[],
    requestedQuestionTypes: string[],
  ): QuizQuestion[] {
    const validQuestions: QuizQuestion[] = [];

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index] as Record<string, unknown>;

      const questionType = q.questionType as string;
      const options = q.options as unknown[];
      const correctAnswers = q.correctAnswers as unknown[];
      const questionText = q.questionText as string;
      const explanation = q.explanation as string | undefined;

      // Validate question type
      if (
        !['mcq', 'true-false', 'multiple-correct'].includes(questionType ?? '')
      ) {
        this.logger.warn(
          `Skipping question ${index}: Invalid question type ${questionType ?? 'undefined'}`,
        );
        continue;
      }

      // Filter out questions that don't match requested types
      if (!requestedQuestionTypes.includes(questionType)) {
        this.logger.warn(
          `Skipping question ${index}: Question type ${questionType} not in requested types`,
        );
        continue;
      }

      // Validate options
      if (!Array.isArray(options) || options.length < 2) {
        this.logger.warn(`Skipping question ${index}: Invalid options count`);
        continue;
      }

      // Check for empty options
      const hasEmptyOptions = options.some(
        (opt) => typeof opt !== 'string' || !opt || opt.trim().length === 0,
      );
      if (hasEmptyOptions) {
        this.logger.warn(`Skipping question ${index}: Contains empty options`);
        continue;
      }

      const stringOptions = options as string[];

      // Check for duplicate options
      const uniqueOptions = new Set(
        stringOptions.map((opt) => opt.trim().toLowerCase()),
      );
      if (uniqueOptions.size !== stringOptions.length) {
        this.logger.warn(
          `Skipping question ${index}: Contains duplicate options`,
        );
        continue;
      }

      // Validate correct answers
      if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
        this.logger.warn(`Skipping question ${index}: Invalid correct answers`);
        continue;
      }

      // Ensure correct answers are valid indices
      const hasInvalidIndices = correctAnswers.some(
        (answerIndex) =>
          typeof answerIndex !== 'number' ||
          answerIndex < 0 ||
          answerIndex >= stringOptions.length,
      );
      if (hasInvalidIndices) {
        this.logger.warn(`Skipping question ${index}: Invalid answer indices`);
        continue;
      }

      const numberCorrectAnswers = correctAnswers as number[];

      // Validate question type requirements
      if (questionType === 'true-false' && stringOptions.length !== 2) {
        this.logger.warn(
          `Skipping question ${index}: True/False must have exactly 2 options`,
        );
        continue;
      }

      if (questionType === 'mcq' && numberCorrectAnswers.length !== 1) {
        this.logger.warn(
          `Skipping question ${index}: MCQ must have exactly 1 correct answer`,
        );
        continue;
      }

      if (
        questionType === 'multiple-correct' &&
        numberCorrectAnswers.length < 2
      ) {
        this.logger.warn(
          `Skipping question ${index}: Multiple-correct must have at least 2 correct answers`,
        );
        continue;
      }

      validQuestions.push({
        questionText: questionText,
        questionType: questionType as 'mcq' | 'true-false' | 'multiple-correct',
        options: stringOptions,
        correctAnswers: numberCorrectAnswers,
        explanation: explanation || 'No explanation provided.',
      });
    }

    if (validQuestions.length === 0) {
      throw new Error('No valid questions generated. Please try again.');
    }

    return validQuestions;
  }
}
