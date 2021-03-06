package controllers.front

import com.gu.facia.api.models.{CollectionConfig, FaciaContent, Groups, LinkSnap}
import common.{ExecutionContexts, Logging, S3Metrics}
import conf.Configuration
import implicits.FaciaContentImplicits._
import model.facia.PressedCollection
import model.{PressedPage, _}
import play.api.libs.json._
import services.{CollectionConfigWithId, SecureS3Request}
import scala.concurrent.Future


trait FrontJsonLite extends ExecutionContexts{
  def get(json: JsValue): JsObject = {
    Json.obj(
      "webTitle" -> (json \ "seoData" \ "webTitle").getOrElse(JsString("")),
      "collections" -> getCollections(json)
    )
  }

  private def getCollections(json: JsValue): Seq[JsValue] = {
    (json \ "collections").asOpt[Seq[Map[String, JsObject]]].getOrElse(Nil).flatMap{ c => c.values.map(getCollection) }
  }

  private def getCollection(json: JsValue): JsValue = {
    Json.obj(
        "displayName" -> (json \ "displayName").getOrElse(JsString("")),
        "href" -> (json \ "href").getOrElse(JsString("")),
        "content" -> getContent(json)
    )
  }

  private def getContent(json: JsValue): Seq[JsValue] = {
    val curated = (json \ "curated").asOpt[Seq[JsObject]].getOrElse(Nil)
    val editorsPicks = (json \ "editorsPicks").asOpt[Seq[JsObject]].getOrElse(Nil)
    val results = (json \ "results").asOpt[Seq[JsObject]].getOrElse(Nil)

    (curated ++ editorsPicks ++ results)
    .filterNot{ j =>
      (j \ "id").asOpt[String].exists(Snap.isSnap)
     }
    .map{ j =>
      Json.obj(
        "headline" -> (j \ "meta" \ "headline").asOpt[JsString].orElse((j \ "safeFields" \ "headline").asOpt[JsString]),
        "trailText" -> (j \ "meta" \ "trailText").asOpt[JsString].orElse((j \ "safeFields" \ "trailText").asOpt[JsString]),
        "thumbnail" -> (j \ "safeFields" \ "thumbnail").asOpt[JsString],
        "shortUrl" -> (j \ "safeFields" \ "shortUrl").asOpt[JsString],
        "id" -> (j \ "id").asOpt[JsString]
      )
    }
  }
}

object FrontJsonLite extends FrontJsonLite

trait FapiFrontJsonLite extends ExecutionContexts{
  def get(pressedPage: PressedPage): JsObject = {
    Json.obj(
      "webTitle" -> pressedPage.seoData.webTitle,
      "collections" -> getCollections(pressedPage))}

  private def getCollections(pressedPage: PressedPage): Seq[JsValue] =
    pressedPage.collections.map(getCollection)

  private def getCollection(pressedCollection: PressedCollection): JsValue =
    Json.obj(
      "displayName" -> pressedCollection.displayName,
      "href" -> pressedCollection.href,
      "id" -> pressedCollection.id,
      "content" -> pressedCollection.curatedPlusBackfillDeduplicated.filterNot(isLinkSnap).map(getContent))

  private def isLinkSnap(faciaContent: FaciaContent) = faciaContent match {
    case _: LinkSnap => true
    case _ => false}

  private def getContent(faciaContent: FaciaContent): JsValue = {
    JsObject(
      Json.obj(
        "headline" -> faciaContent.headline,
        "trailText" -> faciaContent.trailText,
        "thumbnail" -> faciaContent.maybeContent.flatMap(_.safeFields.get("thumbnail")),
        "shortUrl" -> faciaContent.shortUrl,
        "id" -> faciaContent.maybeContent.map(_.id),
        "group" -> faciaContent.group,
        "frontPublicationDate" -> faciaContent.maybeFrontPublicationDate)
      .fields
      .filterNot{ case (_, v) => v == JsNull})
  }
}

object FapiFrontJsonLite extends FapiFrontJsonLite


trait FrontJson extends ExecutionContexts with Logging {

  val stage: String = Configuration.facia.stage.toUpperCase
  val bucketLocation: String

  private def getAddressForPath(path: String): String = s"$bucketLocation/${path.replaceAll("""\+""","%2B")}/pressed.json"

  def getRaw(path: String): Future[Option[String]] = {
    val response = SecureS3Request.urlGet(getAddressForPath(path)).get()
    response.map { r =>
      r.status match {
        case 200 => Some(r.body)
        case 403 =>
          S3Metrics.S3AuthorizationError.increment()
          log.warn(s"Got 403 trying to load path: $path")
          None
        case 404 =>
          log.warn(s"Got 404 trying to load path: $path")
          None
        case responseCode =>
          log.warn(s"Got $responseCode trying to load path: $path")
          None
      }
    }
  }

  def get(path: String): Future[Option[FaciaPage]] = {
    getRaw(path).map {
      _.flatMap {
        body => parsePressedJson(body)
      }
    }
  }

  def getAsJsValue(path: String): Future[JsValue] = {
    val response = SecureS3Request.urlGet(getAddressForPath(path)).get()

    response.map { r =>
      r.status match {
        case 200 => Json.parse(r.body)
        case _   => JsObject(Nil)
      }
    }
  }

  private def parseCollection(json: JsValue): Collection = {
    val displayName: Option[String] = (json \ "displayName").asOpt[String]
    val href: Option[String] = (json \ "href").asOpt[String]
    val description: Option[String] = (json \ "description").asOpt[String]
    val curated =      (json \ "curated").asOpt[List[JsValue]].getOrElse(Nil)
      .flatMap(Content.fromPressedJson)
    val editorsPicks = (json \ "editorsPicks").asOpt[List[JsValue]].getOrElse(Nil)
      .flatMap(Content.fromPressedJson)
    val mostViewed = (json \ "mostViewed").asOpt[List[JsValue]].getOrElse(Nil)
      .flatMap(Content.fromPressedJson)
    val results = (json \ "results").asOpt[List[JsValue]].getOrElse(Nil)
      .flatMap(Content.fromPressedJson)
    val treats = (json \ "treats").asOpt[List[JsValue]].getOrElse(Nil)
      .flatMap(Content.fromPressedJson)

    val lastUpdated = (json \ "lastUpdated").asOpt[String]
    val updatedBy = (json \ "updatedBy").asOpt[String]
    val updatedEmail = (json \ "updatedEmail").asOpt[String]

    Collection(
      curated=curated,
      editorsPicks=editorsPicks,
      mostViewed=mostViewed,
      results=results,
      treats=treats,
      displayName=displayName,
      href=href,
      lastUpdated=lastUpdated,
      updatedBy=updatedBy,
      updatedEmail=updatedEmail
    )
  }

  private def parseOutTuple(json: JsValue): List[(CollectionConfigWithId, Collection)] = {
    (json \ "collections").as[List[Map[String, JsValue]]].flatMap { m =>
      m.map { case (id, j) =>
        (CollectionConfigWithId(id, parseConfig(id, j)), parseCollection(j))
      }
    }
  }

  def parseConfig(id: String, json: JsValue): CollectionConfig =
    CollectionConfig(
      apiQuery        = (json \ "apiQuery").asOpt[String],
      displayName     = (json \ "displayName").asOpt[String],
      href            = (json \ "href").asOpt[String],
      description     = (json \ "description").asOpt[String],
      groups          = (json \ "groups").asOpt[List[String]].map(Groups.apply),
      collectionType  = (json \ "type").asOpt[String].getOrElse(CollectionConfig.DefaultCollectionType),
      showTags        = (json \ "showTags").asOpt[Boolean].exists(identity),
      showSections    = (json \ "showSections").asOpt[Boolean].exists(identity),
      uneditable      = (json \ "uneditable").asOpt[Boolean].exists(identity),
      hideKickers     = (json \ "hideKickers").asOpt[Boolean].exists(identity),
      showDateHeader =  (json \ "showDateHeader").asOpt[Boolean].exists(identity),
      showLatestUpdate = (json \ "showLatestUpdate").asOpt[Boolean].exists(identity),
      excludeFromRss = (json \ "excludeFromRss").asOpt[Boolean].exists(identity),
      showTimestamps = (json \ "showTimestamps").asOpt[Boolean].exists(identity)
    )

  private def parsePressedJson(j: String): Option[FaciaPage] = {
    val json = Json.parse(j)
    val id: String = (json \ "id").as[String]
    Option(
      FaciaPage(
        id,
        seoData = parseSeoData(id, (json \ "seoData").asOpt[JsValue].getOrElse(JsNull)),
        frontProperties = parseFrontProperties((json \ "frontProperties").asOpt[JsValue].getOrElse(JsNull)),
        collections = parseOutTuple(json)
      )
    )
  }

  private def parseSeoData(id: String, seoJson: JsValue): SeoData = {
    val seoDataJson = SeoDataJson(
      id,
      (seoJson \ "navSection").asOpt[String].filter(_.nonEmpty),
      (seoJson \ "webTitle").asOpt[String].filter(_.nonEmpty),
      (seoJson \ "title").asOpt[String].filter(_.nonEmpty),
      (seoJson \ "description").asOpt[String].filter(_.nonEmpty)
    )

    val seoDataFromPath: SeoData = SeoData.fromPath(id)

    SeoData(
      id,
      seoDataJson.navSection.getOrElse(seoDataFromPath.navSection),
      seoDataJson.webTitle.getOrElse(seoDataFromPath.webTitle),
      seoDataJson.title,
      seoDataJson.description.orElse(seoDataFromPath.description)
      )
  }

  def parseFrontProperties(json: JsValue) = FrontProperties(
    onPageDescription = (json \ "onPageDescription").asOpt[String].filter(_.nonEmpty),
    imageUrl = (json \ "imageUrl").asOpt[String].filter(_.nonEmpty),
    imageWidth = (json \ "imageWidth").asOpt[String].filter(_.nonEmpty),
    imageHeight = (json \ "imageHeight").asOpt[String].filter(_.nonEmpty),
    isImageDisplayed = (json \ "isImageDisplayed").asOpt[Boolean].getOrElse(false),
    editorialType = (json \ "editorialType").asOpt[String].filter(_.nonEmpty)
  )

}

object FrontJsonLive extends FrontJson {
  val bucketLocation: String = s"$stage/frontsapi/pressed/live"
}
