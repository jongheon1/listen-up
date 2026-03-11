# 세그먼트 클릭 시 이전 문장 끝 재생 문제 — 근본적 수정

## Context

STT word-level timestamps로 빌드된 세그먼트가 완전히 연속됨 (e.g., seg0.end=4, seg1.start=4).
세그먼트 클릭 시 `audio.currentTime = seg.start`로 시킹하면, 브라우저 오디오 디코더가 정확한 위치 대신 가장 가까운 MP3 프레임 경계로 시킹하여 이전 세그먼트 끝부분이 살짝 재생됨.

기존 `+ 0.05` 하드코딩은 2곳에만 적용되어 있고, 나머지 6곳의 시킹은 미적용 상태. 근본적 해결 필요.

## 원인 분석

1. **데이터 레벨**: Whisper가 연속적인 word timestamps를 반환 → 세그먼트 간 gap 없음
2. **재생 레벨**: `audio.currentTime` 할당 후 브라우저가 실제 시킹 완료 전에 이전 위치의 오디오가 잠깐 재생될 수 있음

## 수정 전략: 2계층 방어

### 계층 1 — 세그먼트 간 최소 gap 보장 (데이터 정규화)
### 계층 2 — pause → seek → `seeked` event → play 패턴 (정밀 시킹)

---

## 변경 내용

### 1. `public-src/player.ts` — 세그먼트 gap 정규화

세그먼트 로드 직후 (line 89) 정규화 함수 적용. 연속 세그먼트의 `seg[i].end`를 `seg[i+1].start - 0.02`로 트리밍.

```typescript
function normalizeSegmentGaps(segs: Segment[]): Segment[] {
  const GAP = 0.02; // 20ms
  for (let i = 0; i < segs.length - 1; i++) {
    if (segs[i].end >= segs[i + 1].start) {
      segs[i].end = segs[i + 1].start - GAP;
    }
  }
  return segs;
}
```

호출: `segments = normalizeSegmentGaps(stt.segments);`

- 20ms는 MP3 프레임(~26ms)보다 작아 인지 불가
- 기존 데이터에 자연 gap이 있으면 (e.g., end=101, start=102) 건드리지 않음

### 2. `public-src/player.ts` — `seekToSegment()` 중앙화 함수

```typescript
function seekToSegment(index: number, andPlay: boolean = true): void {
  if (!audio || index < 0 || index >= segments.length) return;
  audio.pause();
  currentIndex = index;
  highlightSegment();
  updateSegmentBarHighlight();
  audio.currentTime = segments[index].start;
  if (andPlay) {
    audio.addEventListener('seeked', () => audio!.play(), { once: true });
  }
}
```

핵심: `audio.pause()`로 이전 위치 오디오 출력을 즉시 차단한 뒤, `seeked` 이벤트(브라우저의 시킹 완료 보장)를 기다린 후에만 `play()`.

### 3. `public-src/player.ts` — 8곳 시킹 리팩토링

| 위치 | 함수 | Before | After |
|------|------|--------|-------|
| ~L314 | `prevSegment` (현재 재생) | `audio.currentTime = cur.start` | `seekToSegment(currentIndex)` |
| ~L316 | `prevSegment` (이전으로) | `currentIndex--; audio.currentTime = ...` | `seekToSegment(currentIndex - 1)` |
| ~L325 | `nextSegment` | `currentIndex++; audio.currentTime = ...` | `seekToSegment(currentIndex + 1)` |
| ~L333 | `replaySegment` | `audio.currentTime = ...` | `seekToSegment(currentIndex)` |
| ~L375-377 | `updateCurrentSegment` (auto-pause) | `audio.pause(); audio.currentTime = ...` | `seekToSegment(newIndex, false)` |
| ~L389 | `updateCurrentSegment` (loop) | `audio.currentTime = seg.start` | `seekToSegment(currentIndex)` |
| ~L422 | seg bar click | `audio.currentTime = ... + 0.05` | `seekToSegment(idx)` |
| ~L455 | subtitle click | `audio.currentTime = ... + 0.05` | `seekToSegment(idx)` |

- `andPlay = false`: auto-pause만 해당 (시킹 후 멈춰 있어야 하므로)
- 나머지 7곳: `andPlay = true` (기본값)
- `+ 0.05` 하드코딩 제거

### 4. `src/stt/stt.service.ts` — 백엔드 gap 정규화

`buildSentenceSegments()` return 직전에 동일한 gap 정규화 로직 추가.
향후 새 STT 데이터가 이미 gap을 가지도록 보장 (프론트엔드 정규화가 no-op이 됨).

---

## 수정 대상 파일

1. `public-src/player.ts` — `normalizeSegmentGaps()`, `seekToSegment()` 추가 + 8곳 리팩토링
2. `src/stt/stt.service.ts` — `buildSentenceSegments()` 끝에 gap 정규화

## 검증

1. `npm run build:frontend` → 빌드 성공
2. 브라우저에서 세그먼트 클릭 시 이전 문장 끝이 안 들림
3. 키보드 prev/next/replay 동작 정상
4. auto-pause 모드: 세그먼트 경계에서 멈추고 다음 세그먼트 시작으로 위치
5. loop 모드: 세그먼트 끝에서 시작으로 정확히 루프
6. seekbar 드래그: 기존과 동일 (변경 없음)
