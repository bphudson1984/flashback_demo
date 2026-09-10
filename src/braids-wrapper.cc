#include "braids/macro_oscillator.h"
#include "stmlib/utils/random.h"
#include <cstring>
#include <cmath>
static braids::MacroOscillator oscillators[8];
static int16_t output[8][24];
static uint8_t sync_data[24];
static float history[8][63], taps[63];
static int position[8];
static int16_t native_buffer[24];
extern "C" {
void init() {
  memset(oscillators, 0, sizeof(oscillators));
  stmlib::Random::Seed(0x12345678);
  memset(history,0,sizeof(history)); memset(position,0,sizeof(position));
  float sum=0;
  for(int k=0;k<63;k++){const double x=k-31; const double sinc=x==0?.46:sin(3.141592653589793*.46*x)/(3.141592653589793*x); taps[k]=sinc*(.42-.5*cos(2*3.141592653589793*k/62)+.08*cos(4*3.141592653589793*k/62));sum+=taps[k];}
  for(int k=0;k<63;k++) taps[k]/=sum;
  for (int i=0;i<8;++i) oscillators[i].Init();
}
int render(int voice, int shape, int pitch, int timbre, int color, int strike) {
  if (voice<0 || voice>7) return 0;
  auto &o = oscillators[voice];
  o.set_shape(static_cast<braids::MacroOscillatorShape>(shape));
  o.set_pitch(pitch);
  o.set_parameters(timbre,color);
  if(strike) o.Strike();
  int out=0;
  for(int block=0;block<2;block++) {
    o.Render(sync_data,native_buffer,24);
    for(int j=0;j<24;j++) {
      int &pos=position[voice]; history[voice][pos]=native_buffer[j];
      if(j&1) {float y=0; for(int k=0;k<63;k++) y+=taps[k]*history[voice][(pos-k+63)%63]; output[voice][out++]=static_cast<int16_t>(fmax(-32767,fmin(32767,y)));}
      pos=(pos+1)%63;
    }
  }
  return reinterpret_cast<intptr_t>(output[voice]);
}
}
