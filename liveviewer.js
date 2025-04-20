import Styles from "../global/styles";
import React, {useEffect, useMemo, useRef, useState} from "react";

import {
    Image,
    PanResponder,
    Pressable,
    Text,
    View,
    Animated as RNAnimated,
    KeyboardAvoidingView,
    Platform, FlatList, AppState, StatusBar, SafeAreaView
} from "react-native";
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from "react-native-reanimated";
import IconButton from "../common/iconbutton";
import {faCircle, faEye, faTimes, faUser} from "@fortawesome/pro-regular-svg-icons";
import VerticalAligner from "../common/verticalaligner";
import {FontAwesomeIcon} from "@fortawesome/react-native-fontawesome";
import {faEllipsis} from "@fortawesome/pro-regular-svg-icons/faEllipsis";
import CommentTextInput from "./commenttextinput";
import Variables from "../global/variables";
import Crypto from "../utils/crypto";
import Time from "../utils/time";
import CommentItem from "./commentitem";
import {useNavigation, useRoute} from "@react-navigation/native";
import Video from "react-native-video";
import {RTCView} from "react-native-webrtc";



const LiveViewer = (props) => {

    const navigation = useNavigation();

    const route = useRoute();

    const [commentArgs, setCommentArgs] = useState({
        replying:null,
        editingComment:null,
        editingReply:null,
        deletingReply: null,
        deletingComment:null
    });

    const [comments, setComments] = useState([]);

    const [commentExtraData, setCommentExtraData] = useState(0);

    const commentAlreadyFetchRef = useRef(false);

    const postCommentsRequestOffset = useRef({start:0, offset:5});

    const [viewerCount, setViewerCount] = useState(0);

    /*******USE EFFECTS********/

    useEffect(() => {

        AppState.addEventListener('change', nextAppState => {

            if (nextAppState.match(/inactive|background/)) {

                let ib = async () => {

                    let livePostViewerAddParams = {
                        user: Variables.userStorerId,
                        post: route.params.id,
                        add: 0
                    };

                    await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerAddParams);

                }

                ib();


            }

            if(nextAppState === 'active') {

                let ia = async () => {

                    let livePostViewerAddParams = {
                        user: Variables.userStorerId,
                        post: route.params.id,
                        add: 1
                    };

                    await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerAddParams);

                }

                ia();

            }


        });

        let f = async () => {

            let livePostViewerAddParams = {
                user: Variables.userStorerId,
                post: route.params.id,
                add: 1
            };

            await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerAddParams);

        }

        f();

        if(!commentAlreadyFetchRef.current) {

            getComments(route.params.id);

        }

        Variables.server.waitForResponse('add_remove_viewers',   async function(res){

            setViewerCount(res.count);

        });

        return async() => {

            let livePostViewerRemoveParams = {
                user: Variables.userStorerId,
                post: route.params.id,
                add: 0
            };

            await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerRemoveParams);

        }



    }, []);

    /*******END USE EFFECTS********/


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

    const close = async() => {

        let livePostViewerRemoveParams = {
            user: Variables.userStorerId,
            post: route.params.id,
            add: 0
        };

        await Variables.server.sendSync('insert_delete_users_in_live_post', livePostViewerRemoveParams);

        setTimeout(() => {
            navigation.goBack();
        }, 300);
    }

    const renderComment = ({item, index}) => {

        return(
            <View style={{ transform: [{ scaleY: -1 }]}}>
                <CommentItem dark={true} item={item} index={index} actions={{}}/>
            </View>

        );

    }

    const processComments = async(storerRet) => {

        let commentData = {
            user: storerRet.user,
            post: route.params.id,
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
                post:route.params.id,
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

    const refreshComment = async (args) => {

        let params = {
            comment: args.id
        }


        let ret = await Variables.storer.sendSync('comment', params);

        let comment = await processComments(ret[0]);

        setComments([comment, ...comments]);
    }

    return(

        <View style={{flex:1, backgroundColor:'black'}}>

            <StatusBar
                backgroundColor={Styles.backgroundColor}
                barStyle="dark-content"
            />



            <View style={{zIndex:3000, position:'absolute', top:Styles.insets.top, height:40, width:'100%', flexDirection:'row'}}>

                <IconButton icon={faTimes} size={20} color={Styles.redColor} onPress={close}/>

                <View style={{flexDirection:'column', flex:1, marginLeft:10}}>

                    {route.params.title != '' && (

                        <Text style={{paddingLeft:5, color: Styles.fontColor,  fontSize: 18, lineHeight: 20, fontFamily: Styles.fontFamily}}>
                            {decodeURIComponent(route.params.title)}
                        </Text>

                    )}

                    <View style={{flexDirection:'row', marginTop:route.params.title != '' ? 20 : 0, paddingBottom:10}}>

                        <Pressable style={{flexDirection:'column'}} onPress={() => actions('Profile')}>
                            <VerticalAligner/>
                            {route.params.profile_photo.file != null ?
                                <View style={{backgroundColor:Styles.whiteColor, borderRadius:17.5, width:35, height:35}}>
                                    <VerticalAligner/>
                                    <Image source={{uri:Variables.serverFileIp() + '/pp/' + route.params.profile_photo.file}} style={{alignSelf:'center', width:30, height:30, borderRadius:15}}/>
                                    <VerticalAligner/>
                                </View>

                                :
                                <View style={{width:40, height:40, borderRadius:20, backgroundColor:Styles.backgroundColor, borderWidth:1, borderColor:Styles.buttonBorderColor}}>
                                    <VerticalAligner/>
                                    <FontAwesomeIcon icon={faUser} size={20} color={Styles.fontColor} style={{alignSelf:'center'}}/>
                                    <VerticalAligner/>
                                </View>
                            }
                            <VerticalAligner/>
                        </Pressable>

                        <View style={{marginLeft:10, flexDirection:'column'}}>
                            <VerticalAligner/>
                            <Text style={{color: Styles.whiteColor,  fontSize: 16, fontWeight:'500', lineHeight: 17.5, fontFamily: Styles.fontFamily}}>
                                {route.params.nickname}
                            </Text>

                            <Text style={{color: Styles.whiteColor,  fontSize: 16, fontWeight:'500', lineHeight: 17.5, fontFamily: Styles.fontFamily}}>
                                {Time.getTimeAgo(route.params.datetime)}
                            </Text>

                            <VerticalAligner/>
                        </View>


                    </View>




                </View>

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


            <View style={{position:'absolute',top:0, left:0, width:'100%', height:Styles.deviceHeight}}>

                <Video
                    resizeMode={'cover'}
                    repeat={true}
                    volume={10}
                    muted={true}
                    paused={false}
                    source={{uri:'http://18.181.163.53:5080/WebRTCApp/streams/' + route.params.content[0].streamId + '.m3u8'}}
                    style={{width:'100%', height:'100%'}}
                    onError={(err) => {
                        console.log(JSON.stringify(err));
                    }}
                />

            </View>

            {/****COMMENTS****/}
            <View style={{width:'60%', height:Styles.deviceHeight - (Styles.insets.top + 120), position:'absolute', bottom:Styles.insets.bottom + 70}}>

                <FlatList data={comments} renderItem={renderComment} extraData={commentExtraData} style={{  transform: [{ scaleY: -1 }] }}/>

            </View>
            {/****END COMMENTS****/}

            <VerticalAligner/>

            <KeyboardAvoidingView style={{backgroundColor:'black'}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? -32 : 0}>

                <CommentTextInput
                    inBottomSheet={false}
                    dark={true}
                    item={route.params}
                    refreshComment={refreshComment}
                    commentArgs={commentArgs}
                    cancelReplyComment={() => setCommentArgs({replying:null, editingComment:null, editingReply: null})}
                    cancelEditComment={() => setCommentArgs({replying:null, editingComment:null, editingReply: null})}
                />

                <View style={{height:Styles.insets.bottom, backgroundColor:Styles.blackColor}}/>

            </KeyboardAvoidingView>





        </View>

    );

}

export default LiveViewer;
