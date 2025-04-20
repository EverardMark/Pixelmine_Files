import Styles from "../global/styles";
import {
    AppState,
    FlatList,
    Keyboard,
    Modal,
    Pressable,
    SafeAreaView,
    StatusBar,
    Text,
    TextInput,
    View
} from "react-native";
import IconButton from "../common/iconbutton";
import {
    faCameraRotate, faCirclePlus,
    faEye, faMagnifyingGlass,
    faPause,
    faPlay, faSliders,
    faStop,
    faTimes,
    faVolumeMute
} from "@fortawesome/pro-regular-svg-icons";
import LanguageSelector from "../language/languageselector";
import Animated, {
    FadeIn,
    FadeOut,
    SlideInDown, SlideInLeft,
    SlideInRight,
    SlideOutDown, SlideOutLeft,
    SlideOutRight
} from "react-native-reanimated";
import VerticalAligner from "../common/verticalaligner";
import React, {useEffect, useRef, useState} from "react";
import {FontAwesomeIcon} from "@fortawesome/react-native-fontawesome";
import Variables from "../global/variables";
import Time from "../utils/time";
import Random from "../utils/random";
import Crypto from "../utils/crypto";
import Data from "../utils/data";
import LabeledInput from "../common/labeledinput";
import CommentItem from "./commentitem";
import CreatePost from "./createpost";
import Confirmation from "../common/confirmation";
import {useNavigation, useRoute} from "@react-navigation/native";
import BottomSheetContainer from "../common/bottomsheetcontainer";
import {useAntMedia} from "../utils/antserver";
import {RTCView} from "react-native-webrtc";





const CreateLive = () => {

    const navigation = useNavigation();

    const props = useRoute();

    const [initialized, setInitialized] = useState(0);

    const [localMedia, setLocalMedia] = useState('');

    const [controls, setControls] = useState(0);

    const [countdown, setCountdown] = useState(5);

    const countdownIntervalRef = useRef(null);


    const [streamId, setStreamId] = useState(0);


    const [comments, setComments] = useState([]);

    const [commentExtraData, setCommentExtraData] = useState(0);

    const [title, setTitle] = useState('');

    const postInstanceSavedRef = useRef(false);

    const [paused, setPaused] = useState(false);

    const postCommentsRequestOffset = useRef({start:0, offset:5});

    const commentAlreadyFetchRef = useRef(false);

    const [viewerCount, setViewerCount] = useState(0);

    const [showCancelLiveModal, setShowCancelLiveModal] = useState(false);

    const [confirmationPage, setConfirmationPage] = useState(1);

    const [cancelLiveProgress, setPostProgress] = useState(0);

    const postIdRef = useRef('');

    const [showBottomSheets, setShowBottomSheets] = useState({
        confirmation:false
    })

    const adaptor = useAntMedia({
        url: 'ws://18.181.163.53/WebRTCApp/websocket',
        mediaConstraints: {
            audio: true,
            video: {
                width: 640,
                height: 480,
                frameRate: 30,
                facingMode: 'front',
            },
        },
        callback(command, data) {
            switch (command) {
                case 'pong':
                    break;
                case 'publish_started':
                    console.log('publish_started');
                    break;
                case 'publish_finished':
                    console.log('publish_finished');
                    adaptor.closeWebSocket();
                    break;
                case 'local_stream_updated':
                    console.log('local_stream_updated');

                    setLocalMedia(adaptor.localStream.current.toURL());
                    break;
                case 'websocket_not_initialized':
                    adaptor.initialiseWebSocket();
                    break;
                case 'websocket_closed':
                    console.log('websocket_closed');
                    adaptor.stopLocalStream();
                    break;
                default:
                    console.log(command);
                    break;
            }
        },
        callbackError: (err, data) => {
            console.error('callbackError', err, data);
        },
        peer_connection_config: {
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
        },
        debug: true,
    });

    /*******USE EFFECTS********/

    useEffect(() => {

        if(localMedia != ''){

            if(props.params.live_continue){

                setControls(4)

            }else {

                setControls(1)

            }

        }

    }, [localMedia])

    useEffect(() => {

        Variables.server.waitForResponse('received_post_comment',   async function(res) {

            let params = {
                comment: res.storer_id
            }


            let ret = await Variables.storer.sendSync('comment', params);

            let comment = await processComments(ret[0]);


            setComments(comments => [comment, ...comments]);

            setTimeout(() => {
                setCommentExtraData(Math.random());
            }, 300);


        });

        Variables.server.waitForResponse('add_remove_viewers',   async function(res){

            setViewerCount(res.count);

        });

        AppState.addEventListener('change', nextAppState => {

            if (nextAppState.match(/inactive|background/)) {

                let ib = async () => {

                    let liveInActiveBackgroundParams = {
                        user:Variables.userStorerId,
                        status:2
                    }

                    await Variables.server.sendSync('pause_resume_live', liveInActiveBackgroundParams);

                }

                ib();


            }

            if(nextAppState === 'active') {

                let ia = async () => {

                    let liveActiveParams = {
                        user:Variables.userStorerId,
                        status:1
                    }

                    await Variables.server.sendSync('pause_resume_live', liveActiveParams);

                }

                ia();

            }


        });




        /*******CONTINUE LIVE********/
        if(props.params.live_continue) {

            setPaused(true);

            setInitialized(4);

            setControls(4);

            setTitle(props.params.data.post.title);

            postIdRef.current = props.params.data.post.id;

            if(!commentAlreadyFetchRef.current) {

                getComments(props.params.data.post.id);

            }

            let f = async () => {


                let livePostViewerParams = {
                    user: Variables.userStorerId,
                    post: props.params.data.post.id,
                    add: 1
                };

                await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerParams);

            }

            f();


        }


        return async() => {

            adaptor.closeWebSocket();

            adaptor.stopLocalStream();

            let liveParams = {
                user:Variables.userStorerId,
                status:2
            }

            await Variables.server.sendSync('pause_resume_live', liveParams);

        }


    }, []);

    useEffect(() => {

        if(countdown === 1){

            clearInterval(countdownIntervalRef.current);

            if(!props.params.live_continue) {

                setTimeout(() => {

                    setControls(3);

                    Random.generate(async function (random) {

                        let tempStreamId = Variables.userStorerId + Time.getTimeStamp() + random + '-live';

                        Crypto.sha256(tempStreamId, function (hash) {

                            setStreamId(hash);

                        });

                    });

                }, 1000);

            }else{

                setStreamId(props.params.data.post.content[0].streamId);

            }


        }


    }, [countdown]);

    useEffect(() => {

        let f = async () => {

            if (streamId != 0) {

                if (!props.params.live_continue) {

                    postLiveContent();

                } else {

                    let liveParams = {
                        user: Variables.userStorerId,
                        status: 1
                    }

                    await Variables.server.sendSync('pause_resume_live', liveParams);

                    setControls(3);

                    adaptor.publish(streamId)


                }

            }

        }

        f();

    }, [streamId]);

    /*******END USE EFFECTS********/

    const continueLive = () => {

        setControls(2)

        countdownIntervalRef.current = setInterval(() => {

            setCountdown((countdown) => countdown - 1);

        }, 1000);


    }


    const processComments = async(storerRet) => {

        let commentData = {
            user: storerRet.user,
            post: postIdRef.current,
            comment: storerRet.comment,
            datetime: storerRet.datetime
        };



        let isVerified = await Crypto.verifyData(commentData, storerRet.signature, storerRet.public_key);

        if (isVerified) {

            let canEditDelete = Crypto.verifySignature(storerRet.hash, storerRet.signature, Variables.pxlKeyPair.publicKey);

            let jsonComment = JSON.parse(Crypto.decryptTextAllPrivateKey(storerRet.comment));

            let jsonProfilePhoto = JSON.parse(storerRet.profile_photo);

            let comment = {
                id: storerRet.storer_id,
                user: storerRet.user,
                post:props.params.data.post.id,
                replies: [],
                edit_delete: canEditDelete,
                comment:jsonComment,
                profile_photo:jsonProfilePhoto,
                nickname: storerRet.nickname,
                datetime: Time.getTimeAgo(storerRet.datetime)
            }

            return comment;

        }else{
            return null;
        }


    }

    const getComments = async(id) => {

        let tempComments = [];

        let postCommentsParams = {
            post: id,
            start: postCommentsRequestOffset.current.start,
            offset: postCommentsRequestOffset.current.offset
        };

        let ret = await Variables.storer.sendSync('post_comments', postCommentsParams);

        for(let i = 0; i < ret.length; i++) {

            let tempComment = await processComments(ret[i]);

            if(tempComment != null) {

                tempComments.push(tempComment);

            }

        }

        setComments(comments => [...comments, ...tempComments]);

        commentAlreadyFetchRef.current = true;

    }

    const postLiveContent = async () => {

        if(!postInstanceSavedRef.current) {

            let content = [];

            let l = {
                id: 0,
                type: 3,
                value: '',
                streamId: streamId,
                height: Variables.deviceHeight
            }

            content.push(l);

            let postDataStorer = {
                title: Crypto.encryptText(Variables.pxlKeyPair.publicKey, encodeURIComponent(title.trim())),
                content: Crypto.encryptText(Variables.pxlKeyPair.publicKey, JSON.stringify(content)),
                description: Crypto.encryptText(Variables.pxlKeyPair.publicKey, ''),
                public_flag: "0",
                layout: "0",
                user: Variables.userStorerId,
                datetime: Time.getCurrent()
            };

            let edPostStorer = await Data.generateStorerData(postDataStorer);

            edPostStorer['keys'] = JSON.stringify({});

            await Variables.storer.sendSync("insert_post", edPostStorer);

            let postDataServer = {
                title: title,
                content: JSON.stringify(content),
                description: '',
                public_flag: "0",
                layout: "0",
                user: Variables.userStorerId,
                datetime: Time.getCurrent(),
            };

            let edPostServer = await Data.generateStorerData(postDataServer);

            edPostServer['storer_id'] = edPostStorer.storer_id;

            postIdRef.current = edPostStorer.storer_id;

            edPostServer['live_status'] = 1;

            await Variables.server.sendSync("insert_post", edPostServer);

            let livePostViewerParams = {
                user: Variables.userStorerId,
                post: edPostStorer.storer_id,
                add: 1
            };

            await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerParams);

            getComments(edPostStorer.storer_id);

            adaptor.publish(streamId);

            postInstanceSavedRef.current = true;

        }

    }

    const onTitleTextChanged = (text) => {
        setTitle(text);
    }

    const startLive = () => {

        setControls(2)

        countdownIntervalRef.current = setInterval(() => {

            setCountdown((countdown) => countdown - 1);

        }, 1000);

    }

    const stop = () => {

        setShowBottomSheets({ confirmation:true});

    }

    const closeKeyboard = () => {
        Keyboard.dismiss();
    }

    const cancelLive = async() => {

        setShowBottomSheets({ confirmation:true});

    }
    const cancelLiveContinue = async() => {

        setConfirmationPage(2)

        let liveParams = {
            user:Variables.userStorerId,
            status:3
        }


        await Variables.server.sendSync('pause_resume_live', liveParams);

        let deleteData = {
            storer_id: postIdRef.current
        }

        await Variables.storer.sendSync("delete_post", deleteData);

        await Variables.server.sendSync("delete_post", deleteData);

        setTimeout(() => {
            setConfirmationPage(3);
        }, 500);

    }

    const cancelLiveCancel = async() => {

        setShowBottomSheets({ confirmation:false});
    }

    const closeConfirmation = async() => {

        setShowBottomSheets({ confirmation:false});

        setTimeout(() => {
            navigation.goBack()
        }, 500);

    }

    const renderComment = ({item, index}) => {

        return(
            <View style={{ transform: [{ scaleY: -1 }]}}>
                <CommentItem dark={true} item={item} index={index} replyComment={{}} editComment={{}} editReply={{}} deleteReply={{}} deleteComment={{}}/>
            </View>
        );

    }

    const close = () => {

        adaptor.closeWebSocket();

        adaptor.stopLocalStream();

        navigation.navigate('HomeCommunityChatProfileNavigation');
    }




    return(


        <View style={{flex:1}}>

            <StatusBar
                backgroundColor={Styles.backgroundColor}
                barStyle="dark-content"
            />

            {/****HEADER****/}

            <View style={{zIndex:1000, position:'absolute', paddingLeft:10, top:Styles.insets.top, height:40, width:'100%', flexDirection:'row'}}>


                {(controls == 0 || controls == 1 ) && (


                    <View >
                        <IconButton icon={faTimes} size={20} color={Styles.whiteColor} onPress={close}/>
                    </View>



                )}

                {(controls == 0 || controls == 1 || controls == 2) && (

                    <View style={{flexDirection:'column', flex:1}}>

                        <Text style={{paddingLeft:5, color: Styles.whiteColor,  fontSize: 18, lineHeight: 20, fontWeight:'700', fontFamily: Styles.fontFamilyBold}}>
                            {LanguageSelector.getText('create_live_title')}
                        </Text>

                        <Text style={{paddingLeft:5,color: Styles.whiteColor, fontSize: 12, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {LanguageSelector.getText('create_live_sub')}
                        </Text>

                    </View>

                )}

                {controls == 3 && (

                    <View style={{flexDirection:'column', flex:1}}>

                        <Text style={{paddingLeft:5, color: Styles.whiteColor,  fontSize: 18, lineHeight: 20, fontWeight:'700', fontFamily: Styles.fontFamilyBold}}>
                            {LanguageSelector.getText('broadcasting_live_title')}
                        </Text>

                        <Text style={{paddingLeft:5,color: Styles.whiteColor, fontSize: 12, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {LanguageSelector.getText('broadcasting_live_sub')}
                        </Text>

                    </View>

                )}





                {controls == 4 && (

                    <View style={{flexDirection:'column', flex:1}}>

                        <Text style={{paddingLeft:5, color: Styles.whiteColor,  fontSize: 18, lineHeight: 20, fontWeight:'700', fontFamily: Styles.fontFamilyBold}}>
                            {LanguageSelector.getText('continue_live_title')}
                        </Text>

                        <Text style={{paddingLeft:5,color: Styles.whiteColor, fontSize: 12, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {LanguageSelector.getText('continue_live_sub')}
                        </Text>

                    </View>

                )}



                <View>

                    <VerticalAligner/>

                    <View style={{flexDirection:'row', marginRight:10}}>

                        <FontAwesomeIcon icon={faEye} size={18} color={Styles.whiteColor}/>

                        <Text style={{paddingLeft:5,color: Styles.whiteColor, fontSize: 12, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {viewerCount}
                        </Text>

                    </View>

                    <VerticalAligner/>

                </View>

            </View>

            {/****END HEADER****/}


            <View style={{position:'absolute', width:'100%', height:'100%', backgroundColor:'black'}}>

                <RTCView streamURL={localMedia} style={{width:'100%', height:'100%'}}/>

            </View>


            {/****COMMENTS****/}
            <View style={{width:'60%', height:Styles.deviceHeight - (Styles.insets.top + 120), position:'absolute', bottom:Styles.insets.bottom + 70}}>

                <FlatList data={comments} renderItem={renderComment} extraData={commentExtraData} style={{  transform: [{ scaleY: -1 }] }}/>

            </View>
            {/****END COMMENTS****/}


            {/****CONTROLS****/}
            <View style={{position:'absolute', bottom:Styles.insets.bottom, overflow:'hidden', height:50, width:Styles.deviceWidth - 40, marginBottom:10, flexDirection:'column', justifyContent:'flex-end', backgroundColor:Styles.backgroundColor, borderRadius:50, left:20}}>

                {controls == 4 && (

                    <View style={{flex:1, flexDirection:'row'}}>

                        <Pressable onPress={continueLive} style={{flex:1}}>
                            <Text style={{textAlign:'center',color: Styles.greenColor, fontSize: 15, fontWeight:'700', lineHeight: 50, fontFamily: Styles.fontFamilyBold}}>
                                {LanguageSelector.getText('create_continue_live_button')}
                            </Text>
                        </Pressable>

                        <Pressable style={{flex:1}} onPress={cancelLive} >
                            <Text style={{textAlign:'center',color: Styles.redColor, fontSize: 15, fontWeight:'700', lineHeight: 50, fontFamily: Styles.fontFamilyBold}}>
                                {LanguageSelector.getText('create_cancel_live_button')}
                            </Text>
                        </Pressable>

                    </View>

                )}

                {controls == 3 && (

                    <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={{flex:1, flexDirection:'row'}}>

                        <Pressable style={{flex:.25}}>
                            <VerticalAligner/>
                            <FontAwesomeIcon icon={paused ? faPlay : faPause} size={20} color={Styles.fontColor} style={{alignSelf:'center'}}/>
                            <VerticalAligner/>
                        </Pressable>

                        <Pressable style={{flex:.25}}>
                            <VerticalAligner/>
                            <FontAwesomeIcon icon={faCameraRotate} size={20} color={Styles.fontColor} style={{alignSelf:'center'}}/>
                            <VerticalAligner/>
                        </Pressable>

                        <Pressable style={{flex:.25}}>
                            <VerticalAligner/>
                            <FontAwesomeIcon icon={faVolumeMute} size={20} color={Styles.fontColor} style={{alignSelf:'center'}}/>
                            <VerticalAligner/>
                        </Pressable>

                        <Pressable style={{flex:.25}} onPress={stop}>
                            <VerticalAligner/>
                            <FontAwesomeIcon icon={faStop} size={20} color={Styles.fontColor} style={{alignSelf:'center'}}/>
                            <VerticalAligner/>
                        </Pressable>

                    </Animated.View>

                )}

                {controls == 2 && (

                    <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
                        <Text style={{textAlign:'center',color: Styles.orangeColor, fontSize: 15, fontWeight:'700', lineHeight: 50, fontFamily: Styles.fontFamilyBold}}>
                            {'Starting in'}{' '}{countdown}
                        </Text>
                    </Animated.View>

                )}

                {controls == 1 && (

                    <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
                        <Pressable onPress={startLive}>
                            <Text style={{textAlign:'center',color: Styles.greenColor, fontSize: 15, fontWeight:'700', lineHeight: 50, fontFamily: Styles.fontFamilyBold}}>
                                {LanguageSelector.getText('create_start_live_button')}
                            </Text>
                        </Pressable>
                    </Animated.View>

                )}

                {controls == 0 && (

                    <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
                        <Text style={{textAlign:'center',color: Styles.orangeColor, fontSize: 15, fontWeight:'700', lineHeight: 50, fontFamily: Styles.fontFamilyBold}}>
                            {LanguageSelector.getText('create_initializing_live')}
                        </Text>
                    </Animated.View>

                )}

            </View>
            {/****END CONTROLS****/}

            <BottomSheetContainer enablePanDownToClose={false} open={showBottomSheets.confirmation} closeCallback={() => setShowBottomSheets({ confirmation:false})}>

                <View style={{flex:1}}>

                    <VerticalAligner/>
                    <View style={{height:240, marginBottom:Styles.insets.bottom}}>

                        <Confirmation

                            question={LanguageSelector.getText('cancel_live_broadcast_title')}
                            sub_question={LanguageSelector.getText('cancel_live_broadcast_sub')}
                            processing={LanguageSelector.getText('progress_cancel_live_broadcast_title')}
                            sub_processing={''}
                            done={LanguageSelector.getText('done_cancel_live_broadcast_title')}
                            sub_done={''}
                            continue={cancelLiveContinue}
                            cancel={cancelLiveCancel}
                            page={confirmationPage}
                            progressColor={Styles.redColor}
                            progress={cancelLiveProgress}
                            close={closeConfirmation}
                        />

                    </View>

                </View>



            </BottomSheetContainer>



        </View>



    );

}

export default CreateLive;
