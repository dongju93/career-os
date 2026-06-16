import { describe, expect, it, vi } from 'vitest';
import type { ApplicationArtifact } from '../types/application-artifact';
import type { ApplicationPlan } from '../types/application-plan';
import { ApiError, CLIENT_CONTRACT_MISMATCH } from './api-error';
import { generateApplicationPlan, generateArtifact } from './strategist';

function okResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

function apiResponse<T>(data: T) {
  return { status: 200, message: 'ok', data };
}

const samplePlan: ApplicationPlan = {
  summary: '백엔드 직무 위주로 정리한 지원 전략입니다.',
  items: [
    {
      job_id: 12,
      company_name: '토스',
      job_title: '백엔드 엔지니어',
      fit_score: 82,
      matched_skills: ['Python', 'PostgreSQL'],
      missing_skills: ['Go'],
      deadline_urgency: 'soon',
      recommended_action: '이번 주 안에 지원서를 제출하세요.',
      rationale: '기술 스택이 잘 맞고 마감이 임박했습니다.',
    },
  ],
};

describe('generateApplicationPlan', () => {
  it('POSTs to /v1/agent/plan with the body and parses the plan', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(apiResponse(samplePlan)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateApplicationPlan({
      group_id: null,
      focus: '백엔드 위주로',
    });

    expect(result.summary).toBe('백엔드 직무 위주로 정리한 지원 전략입니다.');
    expect(result.items[0].fit_score).toBe(82);
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/v1/agent/plan`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ group_id: null, focus: '백엔드 위주로' }),
      }),
    );
    // Single request — the plan POST must never retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a 502, even though the status is retryable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(
        {
          type: 'about:blank',
          title: 'Bad Gateway',
          status: 502,
          detail: '에이전트 실행에 실패했습니다.',
          instance: '/v1/agent/plan',
        },
        502,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateApplicationPlan({})).rejects.toBeInstanceOf(ApiError);
    // The expensive plan run is single-attempt: no double-billing on failure.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH on schema mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse({ status: 200, message: 'ok', data: { summary: 5 } }),
        ),
    );

    await expect(generateApplicationPlan({})).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
  });

  // §6: clients must treat proposed_actions as optional. The schema's
  // `.default([])` lets a pre-Phase-2 backend (field absent) still parse.
  it('defaults proposed_actions to [] when the field is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(samplePlan))),
    );

    const result = await generateApplicationPlan({});

    expect(result.proposed_actions).toEqual([]);
  });

  it('parses proposed_actions when the backend includes them', async () => {
    const planWithActions = {
      ...samplePlan,
      proposed_actions: [
        {
          action_type: 'set_status',
          job_id: 12,
          application_status: 'applied',
          target_group_id: null,
          memo: null,
          reason: '지원을 완료했다면 상태를 업데이트하세요.',
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse(apiResponse(planWithActions))),
    );

    const result = await generateApplicationPlan({});

    expect(result.proposed_actions).toHaveLength(1);
    expect(result.proposed_actions?.[0]).toMatchObject({
      action_type: 'set_status',
      job_id: 12,
      application_status: 'applied',
    });
  });
});

const sampleArtifact: ApplicationArtifact = {
  artifact_type: 'resume_bullets',
  job_id: 12,
  title: '백엔드 엔지니어 이력서 불릿',
  content_markdown: '- Python으로 결제 시스템 구축\n- PostgreSQL 쿼리 최적화',
};

describe('generateArtifact', () => {
  it('POSTs to /v1/agent/artifact with the body and parses the artifact', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(apiResponse(sampleArtifact)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateArtifact({
      job_id: 12,
      artifact_type: 'resume_bullets',
      focus: '결제 도메인 강조',
    });

    expect(result.title).toBe('백엔드 엔지니어 이력서 불릿');
    expect(result.artifact_type).toBe('resume_bullets');
    expect(fetchMock).toHaveBeenCalledWith(
      `${import.meta.env.VITE_API_BASE_URL}/v1/agent/artifact`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          job_id: 12,
          artifact_type: 'resume_bullets',
          focus: '결제 도메인 강조',
        }),
      }),
    );
    // Single request — the artifact POST must never retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a 502, even though the status is retryable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse(
        {
          type: 'about:blank',
          title: 'Bad Gateway',
          status: 502,
          detail: '에이전트 실행에 실패했습니다.',
          instance: '/v1/agent/artifact',
        },
        502,
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateArtifact({ job_id: 12, artifact_type: 'cover_letter' }),
    ).rejects.toBeInstanceOf(ApiError);
    // The expensive artifact run is single-attempt: no double-billing on failure.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError with CLIENT_CONTRACT_MISMATCH on schema mismatch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okResponse({ status: 200, message: 'ok', data: { title: 5 } }),
        ),
    );

    await expect(
      generateArtifact({ job_id: 12, artifact_type: 'interview_prep' }),
    ).rejects.toMatchObject({
      code: CLIENT_CONTRACT_MISMATCH,
    });
  });
});
