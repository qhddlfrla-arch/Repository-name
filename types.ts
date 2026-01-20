
export interface Scene {
  sceneNumber: number;
  title: string;
  description: string;
  visualPrompt: string;
  videoPrompt: string; // 영상 제작을 위한 구체적인 묘사
  cameraMovement: string; // 카메라 무빙 (Dolly in, Pan left 등)
  narrative: string;
  scriptStartSentence: string; // 대본의 시작 문장
  scriptEndSentence: string; // 대본의 끝 문장
  estimatedDuration?: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string; // 생성된 영상 URL
  error?: string;
}

export interface CharacterProfile {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  isGenerating: boolean;
}

export interface StoryboardData {
  scenes: Scene[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  GENERATING_CHARACTERS = 'GENERATING_CHARACTERS',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  GENERATING_VIDEO = 'GENERATING_VIDEO', 
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type VisualStyle = 
  | 'Default' | 'Classic50s' | 'Joseon' | 'NorthKorea' | 'Mystery' | 'Horror' 
  | 'Silent20s' | 'Camcorder90s' | 'ModernDrama' | 'Melodrama' | 'LegalDrama' | 'Cyberpunk'
  | 'Watercolor' | 'DigitalWebtoon' | 'PencilSketch' | 'Joseon2D' | 'InkMonochrome' | 'NeonCity'
  | 'Buddhist' | 'Renaissance' | 'CuteCharacter';

export const VISUAL_STYLES: { id: VisualStyle; label: string; desc: string }[] = [
  { id: 'Default', label: '기본 설정', desc: '자연스럽고 선명한 기본 스타일' },
  { id: 'Classic50s', label: '50년대 클래식영화', desc: '테크니컬러 색감, 부드러운 조명' },
  { id: 'Joseon', label: '조선시대 사극', desc: '전통적 건축 의복 등, 자연감 활용' },
  { id: 'NorthKorea', label: '북한 드라마', desc: '빈티지 영화 스타일, 강렬한 색감' },
  { id: 'Mystery', label: '미스터리 스릴러', desc: '저조도, 명수부 흔, 음영 그림자' },
  { id: 'Horror', label: '공포-서스펜스', desc: '어두운 조명, 음산한 분위기' },
  { id: 'Silent20s', label: '20년대 무성영화', desc: '흑백, 높은 콘트라스트, 빈티지' },
  { id: 'Camcorder90s', label: '90년대 캠코더', desc: 'VHS 화질, 모노 화면 등, 노이즈' },
  { id: 'ModernDrama', label: '현대 드라마', desc: '자연스럽고 선명한 화질, 자연스런 색감' },
  { id: 'Melodrama', label: '멜로드라마', desc: '부드러운 콘트라스트, 따스하고 화사함' },
  { id: 'LegalDrama', label: '법정 드라마', desc: '차갑고 어두운 화질, 낮은 채도' },
  { id: 'Cyberpunk', label: '사이버펑크 네온', desc: '네온 색감, 비 모습, 미래적인' },
  { id: 'Watercolor', label: '수채화풍 아날로그', desc: '부드럽고 감성적인 수채화 텍스처' },
  { id: 'DigitalWebtoon', label: '디지털 웹툰', desc: '선명한 라인과 화려한 색감의 웹툰' },
  { id: 'PencilSketch', label: '흑백 드로잉 스케치', desc: '거친 연필 선이 살아있는 스케치' },
  { id: 'Joseon2D', label: '조선시대 풍속화 2D', desc: '조선시대 웹툰 스타일 2D 애니' },
  { id: 'InkMonochrome', label: '동양 수묵화 모노', desc: '여백의 미가 돋보이는 먹물 그림' },
  { id: 'NeonCity', label: '네온사인 시티팝', desc: '80년대 레트로 풍의 화려한 야경' },
  { id: 'Buddhist', label: '불교 미니멀리즘', desc: '사실적인 한국 사찰과 불상 배경' },
  { id: 'Renaissance', label: '르네상스 명화', desc: '성경 인물 혹은 명화풍, 현대인물' },
  { id: 'CuteCharacter', label: '귀여운 동물 캐릭터', desc: '웹툰 스타일의 의인화된 동물 캐릭터' },
];
