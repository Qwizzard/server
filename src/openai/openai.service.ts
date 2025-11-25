import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  QuizQuestion,
  GenerateQuizParams,
  GenerateAdaptiveQuizParams,
  WrongAnswer,
} from './openai.interfaces';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;
  private readonly logger = new Logger(OpenAIService.name);
  private readonly model: string;

  constructor(
    private configService: ConfigService,
    private analyticsService: AnalyticsService,
  ) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
    }

    this.openai = new OpenAI({ apiKey: apiKey || '' });
    this.model = this.configService.get<string>('openai.model') || 'gpt-4o';
    this.logger.log(`Using OpenAI model: ${this.model}`);

    if (this.analyticsService.isEnabled()) {
      this.logger.log('LLM analytics tracking enabled');
    }
  }

  async generateQuiz(
    params: GenerateQuizParams,
    userId?: string,
  ): Promise<QuizQuestion[]> {
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

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'You are an expert quiz creator. Generate educational quiz questions in valid JSON format only. Do not include any markdown formatting or code blocks. Ensure all options are unique and non-empty.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      // Track LLM analytics
      this.trackLLMGeneration(
        'generate_quiz',
        startTime,
        response,
        {
          topic,
          difficulty,
          questionTypes,
          numberOfQuestions,
        },
        messages,
        userId,
      );

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

  async generateAdaptiveQuiz(
    params: GenerateAdaptiveQuizParams,
    userId?: string,
  ): Promise<{ questions: QuizQuestion[]; weakTopics: string[] }> {
    const {
      originalTopic,
      originalDifficulty,
      questionTypes,
      numberOfQuestions,
      wrongAnswers,
      focusOnWeakAreas,
      useHarderDifficulty,
    } = params;

    const targetDifficulty = this.getNextDifficulty(
      originalDifficulty,
      useHarderDifficulty,
    );

    try {
      let weakTopics: string[] = [];

      if (focusOnWeakAreas && wrongAnswers.length > 0) {
        // First, extract weak topics using AI
        weakTopics = await this.extractWeakTopics(
          wrongAnswers,
          originalTopic,
          userId,
        );
        this.logger.log(
          `Extracted weak topics: ${weakTopics.join(', ') || 'none'}`,
        );
      }

      const prompt = this.buildAdaptivePrompt(
        originalTopic,
        targetDifficulty,
        questionTypes,
        numberOfQuestions,
        wrongAnswers,
        weakTopics,
        focusOnWeakAreas,
      );

      this.logger.log(
        `Generating adaptive quiz: topic=${originalTopic}, difficulty=${targetDifficulty}, focusOnWeakAreas=${focusOnWeakAreas}`,
      );

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'You are an expert adaptive learning quiz creator. Generate educational quiz questions that help students improve in their weak areas. Return valid JSON format only without markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      // Track LLM analytics
      this.trackLLMGeneration(
        'generate_adaptive_quiz',
        startTime,
        response,
        {
          originalTopic,
          targetDifficulty,
          focusOnWeakAreas,
          numberOfQuestions,
          weakTopicsCount: weakTopics.length,
        },
        messages,
        userId,
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(content) as {
        questions?: unknown[];
      };
      const questions = parsedResponse.questions || [];

      const validQuestions = this.validateAndFormatQuestions(
        questions,
        questionTypes,
      );

      return { questions: validQuestions, weakTopics };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to generate adaptive quiz: ${errorMessage}`,
        errorStack,
      );
      throw new InternalServerErrorException(
        'Failed to generate adaptive quiz. Please try again.',
      );
    }
  }

  private async extractWeakTopics(
    wrongAnswers: WrongAnswer[],
    originalTopic: string,
    userId?: string,
  ): Promise<string[]> {
    if (wrongAnswers.length === 0) {
      return [];
    }

    const wrongAnswersContext = wrongAnswers
      .map((wa, index) => {
        return `Question ${index + 1}: ${wa.questionText}
Type: ${wa.questionType}
Correct concept: ${wa.explanation}`;
      })
      .join('\n\n');

    const prompt = `Analyze these incorrect answers from a quiz about "${originalTopic}" and identify 3-5 specific underlying topics or concepts the student needs to work on.

${wrongAnswersContext}

Return a JSON object with an array of topics (short phrases, 2-4 words each). These should be specific subtopics or concepts within "${originalTopic}".

Example format:
{
  "topics": ["variable scope", "closures", "event loop"]
}

Be specific and actionable. Focus on the underlying concepts, not just the question content.`;

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'You are an expert educational analyst who identifies learning gaps. Return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      // Track LLM analytics
      this.trackLLMGeneration(
        'extract_weak_topics',
        startTime,
        response,
        {
          originalTopic,
          wrongAnswersCount: wrongAnswers.length,
        },
        messages,
        userId,
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content) as { topics?: string[] };
      return parsed.topics || [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to extract weak topics: ${errorMessage}, continuing anyway`,
      );
      return [];
    }
  }

  private getNextDifficulty(
    currentDifficulty: 'easy' | 'medium' | 'hard',
    shouldIncrease: boolean,
  ): 'easy' | 'medium' | 'hard' {
    if (!shouldIncrease) {
      return currentDifficulty;
    }

    const difficultyMap = {
      easy: 'medium' as const,
      medium: 'hard' as const,
      hard: 'hard' as const,
    };

    return difficultyMap[currentDifficulty];
  }

  private buildAdaptivePrompt(
    originalTopic: string,
    difficulty: string,
    questionTypes: string[],
    numberOfQuestions: number,
    wrongAnswers: WrongAnswer[],
    weakTopics: string[],
    focusOnWeakAreas: boolean,
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

    let weakAreasContext = '';
    if (focusOnWeakAreas && weakTopics.length > 0) {
      const weakTopicsString = weakTopics.join(', ');
      const numberOfWeakQuestions = Math.ceil(numberOfQuestions * 0.75); // 75% focus
      const numberOfNewQuestions = numberOfQuestions - numberOfWeakQuestions;

      weakAreasContext = `

IMPORTANT FOCUS AREAS:
The student struggled with these specific concepts: ${weakTopicsString}

Generate approximately ${numberOfWeakQuestions} questions (70-80% of total) that specifically address and reinforce these weak areas. 
The remaining ${numberOfNewQuestions} questions should cover other aspects of "${originalTopic}" to provide comprehensive learning.

For weak area questions:
- Approach the concepts from different angles
- Build understanding progressively
- Include related subtopics that strengthen these concepts
- Ensure questions are educational and help fill the knowledge gaps`;
    } else if (wrongAnswers.length > 0) {
      weakAreasContext = `

The student had some incorrect answers in a previous quiz. Generate questions that help reinforce understanding of "${originalTopic}" while avoiding repetition of the exact same questions.`;
    }

    return `Generate ${numberOfQuestions} ${difficultyDescriptions[difficulty]} quiz questions about "${originalTopic}".${weakAreasContext}

IMPORTANT: You MUST ONLY generate questions of these types: ${typeInstructions}
Do NOT generate questions of any other type. Each question must be one of: ${questionTypes.join(', ')}.

For each question, provide:
1. A clear question text
2. The appropriate number of options (4 for MCQ/multiple-correct, 2 for true-false)
3. ALL options MUST be unique - no duplicate options allowed
4. ALL options MUST have non-empty text
5. The correct answer(s) as an array of indices (0-based)
6. A brief explanation (2-3 sentences) of why the answer is correct

CRITICAL: Ensure questions are DIFFERENT from any previous quiz. Create fresh questions that test the same concepts in new ways.

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

  /**
   * Track LLM generation event to PostHog
   */
  private trackLLMGeneration(
    eventName: string,
    startTime: number,
    response: OpenAI.Chat.Completions.ChatCompletion,
    additionalProperties?: Record<string, unknown>,
    messages?: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    userId?: string,
  ): void {
    if (!this.analyticsService.isEnabled()) {
      this.logger.debug('Analytics disabled, skipping LLM tracking');
      return;
    }

    const latency = (Date.now() - startTime) / 1000; // in seconds
    const usage = response.usage;

    // Calculate estimated cost (approximate prices for GPT-4o as of 2024)
    const inputCostPer1k = 0.0025; // $2.50 per 1M tokens
    const outputCostPer1k = 0.01; // $10 per 1M tokens
    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const totalCost =
      (inputTokens / 1000) * inputCostPer1k +
      (outputTokens / 1000) * outputCostPer1k;

    this.logger.log(
      `🤖 LLM Generation: ${eventName} | Tokens: ${inputTokens}→${outputTokens} | Cost: $${totalCost.toFixed(4)} | Latency: ${latency.toFixed(2)}s`,
    );

    // Format input messages for PostHog (required for LLM Analytics page)
    const aiInput = messages?.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Format output choices for PostHog (required for LLM Analytics page)
    const aiOutputChoices = response.choices.map((choice) => ({
      index: choice.index,
      message: {
        role: choice.message.role,
        content: choice.message.content,
      },
      finish_reason: choice.finish_reason,
    }));

    // Generate trace and span IDs for tracking (required for Traces view)
    const traceId = `${userId || 'anonymous'}-${Date.now()}`;
    const spanId = `${eventName}-${response.id}`;

    this.analyticsService.capture(userId || 'anonymous', '$ai_generation', {
      $ai_model: response.model,
      $ai_latency: latency,
      $ai_input: aiInput, // Required for LLM Analytics page
      $ai_input_tokens: inputTokens,
      $ai_output_choices: aiOutputChoices, // Required for LLM Analytics page
      $ai_output_tokens: outputTokens,
      $ai_total_cost_usd: totalCost,
      $ai_trace_id: traceId, // Required for Traces tab
      $ai_span_id: spanId, // Required for Traces tab
      $ai_span_name: eventName, // Human-readable span name
      generation_type: eventName,
      ...additionalProperties,
    });
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
