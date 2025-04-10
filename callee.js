import Socket from 'socket.io-client';
import {Animated, FlatList, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from "react-native";
import React, { useRef, useState, useEffect, Component, useCallback } from "react";


import Device from "../utils/device";
import Variables from "../global/variables";
import {useNavigation, useRoute} from "@react-navigation/native";
import Styles from "../global/styles";
import VerticalAligner from "../common/verticalaligner";
import {FontAwesomeIcon} from "@fortawesome/react-native-fontawesome";
import {faAbacus, faPhoneArrowDown, faPhoneArrowUp, faUser} from "@fortawesome/pro-regular-svg-icons";
import LanguageSelector from "../language/languageselector";

import {RTCView, mediaDevices, RTCIceCandidate, RTCPeerConnection} from "react-native-webrtc";


const Callee = (props) => {


    const navigation = useNavigation();

    const route = useRoute();

    const callerIdRef = useRef(route.params.caller);

    const remoteStreamRef = useRef(null);

    const localStreamRef = useRef(null);

    const iceCandidatesRef = useRef([]);

    const [answered, setAnswered] = useState(false);

    const answeredRef = useRef(false);

    const [callMessage, setCallMessage] = useState('');

    const counterFunctionRef = useRef(null);

    const [userDetails, setUserDetails] = useState({
        nickname:route.params.user.nickname,
        fn:route.params.user.firstname,
        ln:route.params.user.lastname,
        profile_photo:null
    });

    const connectionBufferRef = useRef(
        new RTCPeerConnection({
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com:19302',
                },
                {
                    urls: 'stun:stun1.l.google.com:19302',
                },
                {
                    urls: 'stun:stun2.l.google.com:19302',
                },
                {
                    urls: 'turn:relay1.expressturn.com:3478',
                    username:'efRUXN0O81N645UV70',
                    credential:'FqzJA2fq3h2VsqXu',
                    credentialType: 'password',

                },
                {
                    urls: 'stun:52.192.65.55:3478',
                },
            ],
        }),
    );

    const initializedRef = useRef(false);

    /*******USE EFFECTS********/

    useEffect(() => {

        Variables.server.waitForResponse('call_dropped_received', async function(ret){

            connectionBufferRef.current.getTransceivers().forEach((transceiver) => {
                transceiver.stop();
            });

            connectionBufferRef.current.close();

            connectionBufferRef.current = null;

            clearInterval(counterFunctionRef.current);

            navigation.navigate('HomeCommunityChatProfileNavigation');


        });

        Variables.server.waitForResponse('ice_candidate_received', async function(ret){

            if(connectionBufferRef.current){

                if(connectionBufferRef.current.remoteDescription) {

                    const candidateBuffer = new RTCIceCandidate(ret.candidate);

                    await connectionBufferRef.current.addIceCandidate(candidateBuffer);

                }else{

                    iceCandidatesRef.current.push(ret.candidate);

                }


            }

        });

        let f = async() => {



            connectionBufferRef.current.onicecandidate = async ({candidate}) => {

                if (candidate) await Variables.server.sendSync('send_ice_candidate', {
                    user: callerIdRef.current,
                    candidate: candidate
                });

            };


            connectionBufferRef.current.ontrack = ({ streams }) => {

                remoteStreamRef.current = streams[0];

            };

            const availableDevices = await mediaDevices.enumerateDevices();

            const sourceId = availableDevices.find(
                device => device.kind === 'videoinput' && device.facing === 'front',
            );

            const streamBuffer = await mediaDevices.getUserMedia({
                audio: true,
                video: {
                    mandatory: {
                        minWidth: 500,
                        minHeight: 300,
                        minFrameRate: 30,
                    },
                    facingMode: 'user',
                    optional: sourceId
                },
            });

            streamBuffer.getVideoTracks()[0].enabled = false;
            streamBuffer.getAudioTracks()[0].enabled = false;

            localStreamRef.current = streamBuffer;

            for (let i = 0; i < streamBuffer.getTracks().length; i++) {

                connectionBufferRef.current.addTrack(streamBuffer.getTracks()[i], streamBuffer);
            }


            await connectionBufferRef.current.setRemoteDescription(route.params.connectionBuffer);

            const localDescription = await connectionBufferRef.current.createAnswer();

            await connectionBufferRef.current.setLocalDescription(localDescription);


            let callParams = {
                user:Variables.userStorerId,
                messaging_channel: route.params.channel,
                connectionBuffer: localDescription
            };


            await Variables.server.sendSync('answer_sdf', callParams);

            initializedRef.current = true;


        }

        f();

    }, []);

    /*******END USE EFFECTS********/



    const answerCall = async() => {

        if(!answeredRef.current) {

            for(let i = 0; i < iceCandidatesRef.current.length; i++){

                const candidateBuffer = new RTCIceCandidate(iceCandidatesRef.current[i]);

                await connectionBufferRef.current.addIceCandidate(candidateBuffer);

            }

            for(let i = 0; i < localStreamRef.current.getAudioTracks().length; i++){
                localStreamRef.current.getAudioTracks()[i].enabled = true
            }

        }

        let callParams = {
            user:Variables.userStorerId,
            messaging_channel: route.params.channel,
        };


        await Variables.server.sendSync('call_answered', callParams);

        let startDate = new Date();

        counterFunctionRef.current = setInterval(() => {

            let nowDate = new Date();

            let ms = nowDate - startDate;

            let seconds = Math.floor(ms / 1000);

            let minutes = Math.floor(seconds / 60);

            let hours = Math.floor(minutes / 60);

            let paddedSeconds = seconds < 10 ? '0' + seconds.toString() : seconds;

            let paddedMinutes = minutes < 10 ? '0' + minutes.toString() : minutes;

            let paddedHours = hours < 10 ? '0' + hours.toString() : hours;

            setCallMessage(paddedHours + ':' + paddedMinutes + ':' + paddedSeconds);

        }, 1000);

        setAnswered(true);


    }

    const dropCall = async() => {

        let callParams = {
            user:Variables.userStorerId,
            messaging_channel: route.params.channel,
        };


        await Variables.server.sendSync('call_dropped', callParams);

        connectionBufferRef.current.getTransceivers().forEach((transceiver) => {
            transceiver.stop();
        });

        connectionBufferRef.current.close();

        connectionBufferRef.current = null;

        clearInterval(counterFunctionRef.current);

        navigation.navigate('HomeCommunityChatProfileNavigation');

    }

    return(

        <View style={{flex:1}}>

            <RTCView streamURL={remoteStreamRef.current?.toURL()} style={{position:'absolute', top:0, width:'100%', height:'100%', backgroundColor:'black'}}/>

            <View style={{flex:1, backgroundColor:Styles.blackColor}}>

                <View style={{marginTop:Styles.insets.top, flexDirection:'column', width:'100%', height:200}}>

                    <VerticalAligner/>

                    {userDetails.profile_photo != null ?
                        <View style={{alignSelf:'center', width:60, height:60, borderRadius:30, backgroundColor:Styles.whiteColor}}>
                            <Image source={{uri:Variables.serverFileIp() + '/pp/' + userDetails.profile_photo}} />
                        </View>
                        :
                        <View style={{alignSelf:'center', width:60, height:60, borderRadius:30, backgroundColor:Styles.whiteColor}}>
                            <VerticalAligner/>
                            <FontAwesomeIcon icon={faUser} size={40} color={Styles.fontColor} style={{alignSelf:'center'}}/>
                            <VerticalAligner/>
                        </View>
                    }



                    <Text style={{textAlign:'center', marginTop:15, color: Styles.whiteColor, fontSize: 20, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                        {userDetails.nickname}
                    </Text>

                    <View style={{alignSelf:'center', flexDirection:'row', marginTop:5}}>

                        <Text style={{textAlign:'center', color: Styles.whiteColor, fontSize: 15, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {userDetails.fn}
                        </Text>
                        <Text style={{textAlign:'center', color: Styles.whiteColor, fontSize: 15, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {' '}
                        </Text>
                        <Text style={{textAlign:'center', color: Styles.whiteColor, fontSize: 15, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {userDetails.ln}
                        </Text>

                    </View>

                    <Text style={{textAlign:'center', color: Styles.orangeColor, marginTop:20, fontSize: 20, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                        {callMessage}
                    </Text>

                    <VerticalAligner/>

                </View>


            </View>

            <View style={{flex:1}}/>

            <View style={{height:70, marginBottom:Styles.insets.bottom}}>

                <View style={{flex:1, flexDirection:'row', backgroundColor:Styles.backgroundColor, marginLeft:20, marginRight:20, borderRadius:50, opacity:.7}}>

                    {!answered ?

                        <View style={{flex:.2}} >

                            <VerticalAligner/>

                            <Pressable onPress={answerCall} style={{alignSelf:'center', backgroundColor:Styles.whiteColor, width:50, height:50, borderRadius:25}}>
                                <VerticalAligner/>
                                <View style={{flexDirection:'column'}}>
                                    <FontAwesomeIcon icon={faPhoneArrowUp} size={25} color={Styles.greenColor} style={{alignSelf:'center'}}/>
                                </View>
                                <VerticalAligner/>
                            </Pressable>

                            <VerticalAligner/>

                        </View>

                        :

                        <View style={{flex:.2}}/>

                    }

                    <View style={{flex:.2}}/>


                    <View style={{flex:.2}}/>

                    <View style={{flex:.2}}/>

                    <View style={{flex:.2}} >

                        <VerticalAligner/>

                        <Pressable onPress={dropCall} style={{alignSelf:'center', backgroundColor:Styles.whiteColor, width:50, height:50, borderRadius:25}}>
                            <VerticalAligner/>
                            <View style={{flexDirection:'column'}}>
                                <FontAwesomeIcon icon={faPhoneArrowDown} size={25} color={Styles.redColor} style={{alignSelf:'center'}}/>
                            </View>
                            <VerticalAligner/>
                        </Pressable>

                        <VerticalAligner/>

                    </View>

                </View>

            </View>

        </View>

    );

}


export default Callee;
