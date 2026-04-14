/**
 * Audio Engine for Binaural Beats
 */

class AudioEngine {
  private context: AudioContext | null = null;
  private leftOsc: OscillatorNode | null = null;
  private rightOsc: OscillatorNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private leftPanner: StereoPannerNode | null = null;
  private rightPanner: StereoPannerNode | null = null;

  private isPlayingLeft = false;
  private isPlayingRight = false;

  private init() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.context.destination);
    }
  }

  public start(leftFreq: number, rightFreq: number) {
    this.init();
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }

    this.startLeft(leftFreq);
    this.startRight(rightFreq);
  }

  public stop() {
    this.stopLeft();
    this.stopRight();
  }

  public startLeft(freq: number) {
    this.init();
    if (this.isPlayingLeft) this.stopLeft();

    this.leftOsc = this.context!.createOscillator();
    this.leftGain = this.context!.createGain();
    this.leftPanner = this.context!.createStereoPanner();

    this.leftOsc.type = 'sine';
    this.leftOsc.frequency.setValueAtTime(freq, this.context!.currentTime);
    this.leftPanner.pan.setValueAtTime(-1, this.context!.currentTime);

    this.leftOsc.connect(this.leftGain);
    this.leftGain.connect(this.leftPanner);
    this.leftPanner.connect(this.masterGain!);

    this.leftOsc.start();
    this.isPlayingLeft = true;
  }

  public stopLeft() {
    if (this.leftOsc) {
      this.leftOsc.stop();
      this.leftOsc.disconnect();
      this.leftOsc = null;
    }
    this.isPlayingLeft = false;
  }

  public startRight(freq: number) {
    this.init();
    if (this.isPlayingRight) this.stopRight();

    this.rightOsc = this.context!.createOscillator();
    this.rightGain = this.context!.createGain();
    this.rightPanner = this.context!.createStereoPanner();

    this.rightOsc.type = 'sine';
    this.rightOsc.frequency.setValueAtTime(freq, this.context!.currentTime);
    this.rightPanner.pan.setValueAtTime(1, this.context!.currentTime);

    this.rightOsc.connect(this.rightGain);
    this.rightGain.connect(this.rightPanner);
    this.rightPanner.connect(this.masterGain!);

    this.rightOsc.start();
    this.isPlayingRight = true;
  }

  public stopRight() {
    if (this.rightOsc) {
      this.rightOsc.stop();
      this.rightOsc.disconnect();
      this.rightOsc = null;
    }
    this.isPlayingRight = false;
  }

  public updateFrequencies(leftFreq: number, rightFreq: number) {
    if (this.leftOsc) {
      this.leftOsc.frequency.setTargetAtTime(leftFreq, this.context!.currentTime, 0.1);
    }
    if (this.rightOsc) {
      this.rightOsc.frequency.setTargetAtTime(rightFreq, this.context!.currentTime, 0.1);
    }
  }

  public getStatus() {
    return {
      left: this.isPlayingLeft,
      right: this.isPlayingRight
    };
  }
}

export const audioEngine = new AudioEngine();
