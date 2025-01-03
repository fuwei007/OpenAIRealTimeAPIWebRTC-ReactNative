import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  PermissionsAndroid,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

// init WebRTC
const RTC_CONFIGURATION = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, // Google STUN server
  ],
};


const App = () => {
  const [connectStatus, setConnectStatus] = useState('notConnect'); // notConnect, connecting, connected
  const [peerConnection, setPeerConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [outputText, setOutputText] = useState('');
  const localStreamRef = useRef(null);

  //Request Audio Permission
  const requestAudioPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs access to your microphone to make calls.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.error('Microphone permission denied');
      }
    } catch (err) {
      console.error('Failed to request microphone permission', err);
    }
  };
  requestAudioPermission();

  //Update button UI
  const refreshStatusButtonUI = () => {
    if (connectStatus === 'notConnect') {return 'Connect';}
    if (connectStatus === 'connecting') {return 'Connecting...';}
    if (connectStatus === 'connected')  {return 'DisConnect';}
  };

  //1.OpenAI -- Get Secret Key
  const connectWebSocket = async () => {
    if (connectStatus !== 'notConnect') {
      return;
    }
    setConnectStatus('connecting');

    try {
      // 1. Get WebSocket key
      const secretDict = await getOpenAIWebSocketSecretKey();
      console.log('1.Secret Key:', secretDict);

      // 2. Init RTCPeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIGURATION);
      console.log('2.Init RTCPeerConnection');

      // 3. Setup local audio
      console.log('3.Setup local audio');
      const localStream = await mediaDevices.getUserMedia({ audio: true });

      if (!localStream || localStream.getTracks().length === 0) {
        console.error('No audio tracks found in the local stream');
        setConnectStatus('notConnect');
        return;
      }else{
        localStream.getTracks().forEach((track) => console.log('local track:',track));
      }

      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      localStreamRef.current = localStream;

      pc.ontrack = (event) => {
        console.log('Remote audio track received:', event.streams[0]);
        // Using mobile phone speakers
        if(event.streams[0]){
          InCallManager.start({ media: 'audio' });
          InCallManager.setSpeakerphoneOn(true);
        }
      };

      // 4. Create data channel
      console.log('4.Create data channel');
      const channel = pc.createDataChannel('oai-events', { ordered: true });
      channel.onopen = () => {console.log('Data channel is open');};
      channel.onmessage = (event) =>{
        console.log('Received message:', event.data);
        handleOpenAIEvent(event);
      };

      setPeerConnection(pc);
      setDataChannel(channel);

      // 5. Create SDP Offer
      console.log('5.Create SDP Offer and connect backend');
      let sessionConstraints = {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: false,
          VoiceActivityDetection: true,
        },
      };
      const offer = await pc.createOffer(sessionConstraints);
      console.log('Generated SDP Offer:', offer.sdp);

      // Validate SDP Offer
      if (!offer.sdp || !offer.sdp.includes('m=audio')) {
        console.error('Invalid SDP Offer, missing audio track:', offer.sdp);
        setConnectStatus('notConnect');
        return;
      }

      // 6. Set Local Description
      console.log('6.Set Local Description');
      try {
        var rsd = new RTCSessionDescription(offer);
        await pc.setLocalDescription(rsd);
        console.log('Local description set successfully');
      } catch (error) {
        console.error('Error setting local description:', error);
        setConnectStatus('notConnect');
        return;
      }

      // 7. Send SDP to Open AI
      console.log('7.Send SDP to Open AI');
      const clientSecret = secretDict?.client_secret?.value;
      if (clientSecret) {
        await sendSDPToServer(pc,offer, clientSecret);
        setConnectStatus('connected');
      } else {
        console.error('Client secret is missing');
        setConnectStatus('notConnect');
      }
    } catch (error) {
      console.error('Error during WebRTC connection:', error);
      setConnectStatus('notConnect');
    }
  };

  // Get Secret Key
  const getOpenAIWebSocketSecretKey = async () => {
    const url = 'https://api.openai.com/v1/realtime/sessions';
    const OPENAI_API_KEY = '<YOUR-SecretKey>';

    const body = {
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'alloy',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch secret key: ${response.statusText}`);
    }

    return await response.json();
  };

  // Send SDP to service
  const sendSDPToServer = async (pc,offer,clientSecret) => {
    console.log('Send SDP to service');
    const url = 'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSecret}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });

    if (!response.ok) {
      throw new Error(`Failed to send SDP to server: ${response.statusText}`);
    }

    const remoteSDP = await response.text();
    console.log('remoteSDP',remoteSDP);

    const remoteDescription = new RTCSessionDescription({ type: 'answer', sdp: remoteSDP });
    console.log('remoteDescription',remoteDescription);
    await pc.setRemoteDescription(remoteDescription);

    console.log('Remote SDP set successfully');
  };

  // disconnect
  const disconnectWebSocket = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setConnectStatus('notConnect');
  };

  //OpenAI Event
  const handleOpenAIEvent = async(event) =>{
    const message = JSON.parse( event.data);
    const { type } = message;
    switch (type) {
      case 'input_audio_buffer.speech_started':
          // startRecording();
        break;
      case 'input_audio_buffer.speech_stopped':
          // stopRecording();
        break;
      case 'input_audio_buffer.committed':
        // stopRecording();
        break;
      case 'response.audio_transcript.done':
        setOutputText(message.transcript);
        break;
      }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WebRTC</Text>
      <Button  style={styles.buttonStyle}
        title={refreshStatusButtonUI()}
        onPress={() => {
          if (connectStatus === 'notConnect') {
            connectWebSocket();
          } else if (connectStatus === 'connected') {
            disconnectWebSocket();
          }
        }}
      />
      {/* <Text style={styles.leftTitle}>Input Text</Text>
      <Text style={styles.leftBackground}>{inputText}</Text> */}
      <Text style={styles.leftTitle}>Output Text</Text>
      <Text style={styles.leftBackground}>{outputText}</Text>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    width:400,
    textAlign:'center',
    fontSize: 20,
    marginBottom: 24,
  },
  leftTitle: {
    marginTop:20,
    width:300,
    textAlign:'left',
    fontSize: 16,
    color:'black',
  },
  leftBackground: {
    marginTop:20,
    width:300,
    height:200,
    overflow:'scroll',
    textAlign:'left',
    fontSize: 12,
    color:'white',
    padding:8,
    backgroundColor:'gray',
  },
  buttonStyle:{
    width:200,
  },
  audioText: {
    marginTop: 20,
    fontSize: 16,
  },
});

export default App;
