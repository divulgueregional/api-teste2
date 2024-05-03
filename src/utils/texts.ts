export const mediaUrlDescription = `The this endpoint allows you to send a media URL to a user.
<br> 
The <strong>url</strong> parameter is the URL of the media to be sent.
<br>
The <strong>to</strong> parameter is the phone number of the user to send the media to.
<br>
The <strong>type</strong> parameter is the type of media to be sent.
<br>
The type of media can be one of the following:
<ul>
<li><strong>image</strong> - an image</li>
<li><strong>video</strong> - a video</li>
<li><strong>audio</strong> - an audio file</li>
<li><strong>document</strong> - a document</li>
</ul>
<br>
The <strong>caption</strong> parameter is the caption of the media to be sent.
<br>
The <strong>mimeType</strong> parameter is the mimeType of the media.
`;

export const templateMessageDescription = `The templateMessage is a special type of message that allows <br />
    you to send a message with a special buttons like quickReply, <br />
    urlButton, callButton, etc. <br />
    <br>
    <strong>How to send templateMessage?</strong> <br />
    <br>
    The messageData object requires you to specify the type of button you <br />
    want to send to the user. <br />
    The type of button you can send are: <br />
    <br>
    <code>replyButton</code><br><br>
    <code>urlButton</code><br><br>
    <code>callButton</code><br><br>
    <br>
    In the <i>payload</i> field, you have to enter the payload <br>
    i.e. url in case of the urlButton or phone number in case of callButton <br>
    <br>
    <strong>Example of templateMessage? </strong> <br />
    <br>
    <code><br>
{<br>
   "messageData":{<br>
      "to":"918788889688",<br>
      "text":"string",<br>
      "buttons":[<br>
         {<br>
            "type":"replyButton",<br>
            "title":"This is a replyButton"<br>
         },<br>
         {<br>
            "type":"urlButton",<br>
            "title":"This is a urlButton",<br>
            "payload":"https://google.com"<br>
         },<br>
         {<br>
            "type":"callButton",<br>
            "title":"This is a callButton",<br>
            "payload":"918788889688"<br>
         }<br>
      ],<br>
      "footerText":"Hello World"<br>
   }<br>
}<br>
    </code>
    <br>
    <strong>NOTE: </strong>
    <i>Due to certain limitations from WhatsApp, when you send templateMessage to someone, <br>
    the message won't be visible in you phone. Also you will also see that the message has been sent <br>
    too your own phone number.<br>
    </i>
`;
