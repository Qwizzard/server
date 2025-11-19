import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface QuizQuestion {
  questionText: string;
  questionType: 'mcq' | 'true-false' | 'multiple-correct';
  options: string[];
  correctAnswers: number[];
  explanation: string;
}

export interface GenerateQuizParams {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionTypes: string[];
  numberOfQuestions: number;
}

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

    const prompt = this.buildPrompt(topic, difficulty, questionTypes, numberOfQuestions);

    try {
      this.logger.log(`Generating quiz for topic: ${topic}, difficulty: ${difficulty}`);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert quiz creator. Generate educational quiz questions in valid JSON format only. Do not include any markdown formatting or code blocks.',
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

      const parsedResponse = JSON.parse(content);
      const questions = parsedResponse.questions || [];

      // Validate and format questions
      return this.validateAndFormatQuestions(questions);
    } catch (error) {
      this.logger.error(`Failed to generate quiz: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to generate quiz. Please try again.');
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

    const typeInstructions = questionTypes.map((type) => {
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
    }).join(', ');

    return `Generate ${numberOfQuestions} ${difficultyDescriptions[difficulty]} quiz questions about "${topic}".

Question types to include: ${typeInstructions}

For each question, provide:
1. A clear question text
2. The appropriate number of options (4 for MCQ/multiple-correct, 2 for true-false)
3. The correct answer(s) as an array of indices (0-based)
4. A brief explanation (2-3 sentences) of why the answer is correct

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

Distribute question types evenly across the requested types. Make sure all questions are educational, accurate, and relevant to the topic.`;
  }

  private validateAndFormatQuestions(questions: any[]): QuizQuestion[] {
    return questions.map((q, index) => {
      // Validate question type
      if (!['mcq', 'true-false', 'multiple-correct'].includes(q.questionType)) {
        throw new Error(`Invalid question type at index ${index}`);
      }

      // Validate options
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error(`Invalid options at index ${index}`);
      }

      // Validate correct answers
      if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) {
        throw new Error(`Invalid correct answers at index ${index}`);
      }

      // Ensure correct answers are valid indices
      q.correctAnswers.forEach((answerIndex: number) => {
        if (answerIndex < 0 || answerIndex >= q.options.length) {
          throw new Error(`Invalid answer index at question ${index}`);
        }
      });

      return {
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        correctAnswers: q.correctAnswers,
        explanation: q.explanation || 'No explanation provided.',
      };
    });
  }
}

