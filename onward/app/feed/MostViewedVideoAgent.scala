package feed

import common._
import common.editions.Uk
import conf.LiveContentApi
import conf.LiveContentApi.getResponse
import model.{Video, _}
import play.api.libs.json._

import scala.concurrent.Future

object MostViewedVideoAgent extends Logging with ExecutionContexts {

  case class QueryResult(id: String, count: Double, paths: Seq[String])

  private val agent = AkkaAgent[Seq[Video]](Nil)

  implicit val ophanQueryReads = Json.reads[QueryResult]

  def mostViewedVideo(): Seq[Video] = agent()

  def refresh(): Unit = {
    log.info("Refreshing most viewed video.")

    val ophanResponse = services.OphanApi.getMostViewedVideos(hours = 3, count = 20)

    ophanResponse.map { result =>

      val paths: Seq[String] = for {
        videoResult <- result.asOpt[JsArray].map(_.value).getOrElse(Nil)
        path <- videoResult.validate[QueryResult].asOpt.map(_.paths).getOrElse(Nil) if path.contains("/video/")
      } yield {
        path
      }

      val contentIds = paths.distinct.take(10)
        .map(id => id.drop(1)) // drop leading '/'
        .mkString(",")

      val mostViewed: Future[Seq[Video]] = getResponse(LiveContentApi.search(Uk)
        .ids(contentIds)
        .pageSize(20)
      ).map(r => r.results.filter(_.isVideo).map(Video(_)))

      mostViewed.filter(_.nonEmpty).foreach(agent.alter)
    }
  }
}
